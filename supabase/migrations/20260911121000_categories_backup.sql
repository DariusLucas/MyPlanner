create or replace function public.export_planner_backup()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  user_id_value uuid := private.require_user_id();
begin
  return jsonb_build_object(
    'format', 'myplanner.supabase',
    'schemaVersion', 2,
    'ownerId', user_id_value,
    'exportedAt', now(),
    'plannerTimezone', coalesce((select timezone from public.app_settings where user_id = user_id_value), 'Europe/Bucharest'),
    'data', jsonb_build_object(
      'app_settings', coalesce((select jsonb_agg(to_jsonb(item) - 'user_id') from public.app_settings item where item.user_id = user_id_value), '[]'::jsonb),
      'categories', coalesce((select jsonb_agg(to_jsonb(item) - 'user_id' order by item.position, item.created_at, item.id) from public.categories item where item.user_id = user_id_value), '[]'::jsonb),
      'goals', coalesce((select jsonb_agg(to_jsonb(item) - 'user_id' order by item.id) from public.goals item where item.user_id = user_id_value), '[]'::jsonb),
      'sprints', coalesce((select jsonb_agg(to_jsonb(item) - 'user_id' order by item.id) from public.sprints item where item.user_id = user_id_value), '[]'::jsonb),
      'sprint_weeks', coalesce((select jsonb_agg(to_jsonb(item) - 'user_id' order by item.start_date, item.id) from public.sprint_weeks item where item.user_id = user_id_value), '[]'::jsonb),
      'weekly_targets', coalesce((select jsonb_agg(to_jsonb(item) - 'user_id' order by item.id) from public.weekly_targets item where item.user_id = user_id_value), '[]'::jsonb),
      'daily_focus', coalesce((select jsonb_agg(to_jsonb(item) - 'user_id' order by item.date, item.id) from public.daily_focus item where item.user_id = user_id_value), '[]'::jsonb),
      'task_recurrences', coalesce((select jsonb_agg(to_jsonb(item) - 'user_id' order by item.start_week, item.id) from public.task_recurrences item where item.user_id = user_id_value), '[]'::jsonb),
      'tasks', coalesce((select jsonb_agg(to_jsonb(item) - 'user_id' order by item.date, item.position, item.id) from public.tasks item where item.user_id = user_id_value), '[]'::jsonb),
      'content_milestones', coalesce((select jsonb_agg(to_jsonb(item) - 'user_id' order by item.created_at, item.id) from public.content_milestones item where item.user_id = user_id_value), '[]'::jsonb),
      'quick_thoughts', coalesce((select jsonb_agg(to_jsonb(item) - 'user_id' order by item.created_at, item.id) from public.quick_thoughts item where item.user_id = user_id_value), '[]'::jsonb),
      'task_events', coalesce((select jsonb_agg(to_jsonb(item) - 'user_id' order by item.occurred_at, item.id) from public.task_events item where item.user_id = user_id_value), '[]'::jsonb)
    )
  );
end;
$$;

create or replace function public.import_planner_backup(p_backup jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  user_id_value uuid := private.require_user_id();
  data_value jsonb;
  version_value integer;
  imported_counts jsonb;
begin
  if p_backup is null or jsonb_typeof(p_backup) <> 'object' or p_backup->>'format' <> 'myplanner.supabase' then
    raise exception 'This is not a MyPlanner Supabase backup.' using errcode = '22023';
  end if;
  version_value := (p_backup->>'schemaVersion')::integer;
  if version_value not in (1, 2) then
    raise exception 'Unsupported backup schema version.' using errcode = '22023';
  end if;
  if (p_backup->>'ownerId')::uuid <> user_id_value then
    raise exception 'This backup belongs to a different Planner account.' using errcode = '42501';
  end if;
  if (p_backup->>'exportedAt')::timestamptz > now() + interval '1 day' then
    raise exception 'Backup export timestamp is invalid.' using errcode = '22023';
  end if;
  data_value := p_backup->'data';
  if data_value is null or jsonb_typeof(data_value) <> 'object' then
    raise exception 'Backup data must be a JSON object.' using errcode = '22023';
  end if;

  drop table if exists pg_temp.planner_backup_app_settings;
  drop table if exists pg_temp.planner_backup_categories;
  drop table if exists pg_temp.planner_backup_goals;
  drop table if exists pg_temp.planner_backup_sprints;
  drop table if exists pg_temp.planner_backup_sprint_weeks;
  drop table if exists pg_temp.planner_backup_weekly_targets;
  drop table if exists pg_temp.planner_backup_daily_focus;
  drop table if exists pg_temp.planner_backup_task_recurrences;
  drop table if exists pg_temp.planner_backup_tasks;
  drop table if exists pg_temp.planner_backup_content_milestones;
  drop table if exists pg_temp.planner_backup_quick_thoughts;
  drop table if exists pg_temp.planner_backup_task_events;

  create temporary table planner_backup_app_settings (like public.app_settings including all) on commit drop;
  create temporary table planner_backup_categories (like public.categories including all) on commit drop;
  create temporary table planner_backup_goals (like public.goals including all) on commit drop;
  create temporary table planner_backup_sprints (like public.sprints including all) on commit drop;
  create temporary table planner_backup_sprint_weeks (like public.sprint_weeks including all) on commit drop;
  create temporary table planner_backup_weekly_targets (like public.weekly_targets including all) on commit drop;
  create temporary table planner_backup_daily_focus (like public.daily_focus including all) on commit drop;
  create temporary table planner_backup_task_recurrences (like public.task_recurrences including all) on commit drop;
  create temporary table planner_backup_tasks (like public.tasks including all) on commit drop;
  create temporary table planner_backup_content_milestones (like public.content_milestones including all) on commit drop;
  create temporary table planner_backup_quick_thoughts (like public.quick_thoughts including all) on commit drop;
  create temporary table planner_backup_task_events (like public.task_events including all) on commit drop;

  insert into pg_temp.planner_backup_app_settings
  select * from jsonb_populate_recordset(null::public.app_settings, (
    select coalesce(jsonb_agg(value || jsonb_build_object('user_id', user_id_value)), '[]'::jsonb)
    from jsonb_array_elements(private.validate_backup_array(data_value, 'app_settings', array['name','theme','week_starts_on','default_career_target_days','default_weekly_applications','default_weekly_content','timezone','revision','created_at','updated_at']))
  ));
  if (select count(*) from pg_temp.planner_backup_app_settings) <> 1 then
    raise exception 'Backup must contain exactly one app settings record.' using errcode = '22023';
  end if;

  if version_value = 2 then
    insert into pg_temp.planner_backup_categories
    select * from jsonb_populate_recordset(null::public.categories, (
      select coalesce(jsonb_agg(value || jsonb_build_object('user_id', user_id_value)), '[]'::jsonb)
      from jsonb_array_elements(private.validate_backup_array(data_value, 'categories', array['id','name','icon','position','archived_at','revision','created_at','updated_at']))
    ));
  end if;

  insert into pg_temp.planner_backup_goals select * from jsonb_populate_recordset(null::public.goals, (select coalesce(jsonb_agg(value || jsonb_build_object('user_id', user_id_value)), '[]'::jsonb) from jsonb_array_elements(private.validate_backup_array(data_value, 'goals', array['id','title','description','category','start_date','target_date','status','revision','created_at','updated_at']))));
  insert into pg_temp.planner_backup_sprints select * from jsonb_populate_recordset(null::public.sprints, (select coalesce(jsonb_agg(value || jsonb_build_object('user_id', user_id_value)), '[]'::jsonb) from jsonb_array_elements(private.validate_backup_array(data_value, 'sprints', array['id','title','start_date','end_date','status','revision','created_at','updated_at']))));
  insert into pg_temp.planner_backup_sprint_weeks select * from jsonb_populate_recordset(null::public.sprint_weeks, (select coalesce(jsonb_agg(value || jsonb_build_object('user_id', user_id_value)), '[]'::jsonb) from jsonb_array_elements(private.validate_backup_array(data_value, 'sprint_weeks', array['id','sprint_id','week_number','title','theme','outcome','start_date','end_date','revision','created_at','updated_at']))));
  insert into pg_temp.planner_backup_weekly_targets select * from jsonb_populate_recordset(null::public.weekly_targets, (select coalesce(jsonb_agg(value || jsonb_build_object('user_id', user_id_value)), '[]'::jsonb) from jsonb_array_elements(private.validate_backup_array(data_value, 'weekly_targets', array['id','sprint_week_id','category','key','label','target_value','revision','created_at','updated_at']))));
  insert into pg_temp.planner_backup_daily_focus select * from jsonb_populate_recordset(null::public.daily_focus, (select coalesce(jsonb_agg(value || jsonb_build_object('user_id', user_id_value)), '[]'::jsonb) from jsonb_array_elements(private.validate_backup_array(data_value, 'daily_focus', array['id','date','career_mission','content_mission','revision','created_at','updated_at']))));
  insert into pg_temp.planner_backup_task_recurrences select * from jsonb_populate_recordset(null::public.task_recurrences, (select coalesce(jsonb_agg(value || jsonb_build_object('user_id', user_id_value)), '[]'::jsonb) from jsonb_array_elements(private.validate_backup_array(data_value, 'task_recurrences', array['id','title','description','category','category_id','priority','estimated_minutes','count_per_week','start_week','active','revision','created_at','updated_at']))));
  insert into pg_temp.planner_backup_tasks select * from jsonb_populate_recordset(null::public.tasks, (select coalesce(jsonb_agg(value || jsonb_build_object('user_id', user_id_value)), '[]'::jsonb) from jsonb_array_elements(private.validate_backup_array(data_value, 'tasks', array['id','title','description','category','category_id','goal_id','sprint_id','sprint_week_id','date','anytime_week_start','recurrence_id','recurrence_week_start','recurrence_index','priority','status','position','estimated_minutes','completed_at','revision','created_at','updated_at']))));
  insert into pg_temp.planner_backup_content_milestones select * from jsonb_populate_recordset(null::public.content_milestones, (select coalesce(jsonb_agg(value || jsonb_build_object('user_id', user_id_value)), '[]'::jsonb) from jsonb_array_elements(private.validate_backup_array(data_value, 'content_milestones', array['id','category','category_id','label','type','target_value','achieved_at','revision','created_at','updated_at']))));
  insert into pg_temp.planner_backup_quick_thoughts select * from jsonb_populate_recordset(null::public.quick_thoughts, (select coalesce(jsonb_agg(value || jsonb_build_object('user_id', user_id_value)), '[]'::jsonb) from jsonb_array_elements(private.validate_backup_array(data_value, 'quick_thoughts', array['id','text','revision','created_at','updated_at']))));
  insert into pg_temp.planner_backup_task_events select * from jsonb_populate_recordset(null::public.task_events, (select coalesce(jsonb_agg(value || jsonb_build_object('user_id', user_id_value)), '[]'::jsonb) from jsonb_array_elements(private.validate_backup_array(data_value, 'task_events', array['id','task_id','kind','occurred_at','created_at']))));

  if version_value = 1 then
    insert into pg_temp.planner_backup_categories (id, user_id, name, icon, position)
    select gen_random_uuid(), user_id_value,
      case category when 'career' then 'Career' when 'content' then 'Content' else 'Personal' end,
      case category when 'career' then 'briefcase' when 'content' then 'clapperboard' else 'coffee' end,
      case category when 'career' then 0 when 'content' then 1 else 2 end
    from (
      select category from pg_temp.planner_backup_tasks union
      select category from pg_temp.planner_backup_task_recurrences union
      select category from pg_temp.planner_backup_content_milestones
    ) used;
    update pg_temp.planner_backup_tasks task set category_id = category.id from pg_temp.planner_backup_categories category
      where category.name = case task.category when 'career' then 'Career' when 'content' then 'Content' else 'Personal' end;
    update pg_temp.planner_backup_task_recurrences recurrence set category_id = category.id from pg_temp.planner_backup_categories category
      where category.name = case recurrence.category when 'career' then 'Career' when 'content' then 'Content' else 'Personal' end;
    update pg_temp.planner_backup_content_milestones milestone set category_id = category.id from pg_temp.planner_backup_categories category
      where category.name = case milestone.category when 'career' then 'Career' else 'Content' end;
  end if;

  imported_counts := jsonb_build_object(
    'categories', (select count(*) from pg_temp.planner_backup_categories),
    'tasks', (select count(*) from pg_temp.planner_backup_tasks),
    'task_recurrences', (select count(*) from pg_temp.planner_backup_task_recurrences),
    'content_milestones', (select count(*) from pg_temp.planner_backup_content_milestones),
    'quick_thoughts', (select count(*) from pg_temp.planner_backup_quick_thoughts)
  );

  delete from public.task_events where user_id = user_id_value;
  delete from public.tasks where user_id = user_id_value;
  delete from public.weekly_targets where user_id = user_id_value;
  delete from public.sprint_weeks where user_id = user_id_value;
  delete from public.task_recurrences where user_id = user_id_value;
  delete from public.daily_focus where user_id = user_id_value;
  delete from public.content_milestones where user_id = user_id_value;
  delete from public.quick_thoughts where user_id = user_id_value;
  delete from public.goals where user_id = user_id_value;
  delete from public.sprints where user_id = user_id_value;
  delete from public.categories where user_id = user_id_value;
  delete from public.app_settings where user_id = user_id_value;

  insert into public.app_settings select * from pg_temp.planner_backup_app_settings;
  insert into public.categories select * from pg_temp.planner_backup_categories;
  insert into public.goals select * from pg_temp.planner_backup_goals;
  insert into public.sprints select * from pg_temp.planner_backup_sprints;
  insert into public.sprint_weeks select * from pg_temp.planner_backup_sprint_weeks;
  insert into public.weekly_targets select * from pg_temp.planner_backup_weekly_targets;
  insert into public.daily_focus select * from pg_temp.planner_backup_daily_focus;
  insert into public.task_recurrences select * from pg_temp.planner_backup_task_recurrences;
  insert into public.tasks select * from pg_temp.planner_backup_tasks;
  insert into public.content_milestones select * from pg_temp.planner_backup_content_milestones;
  insert into public.quick_thoughts select * from pg_temp.planner_backup_quick_thoughts;
  insert into public.task_events select * from pg_temp.planner_backup_task_events;

  return jsonb_build_object('ok', true, 'schemaVersion', 2, 'imported', imported_counts);
end;
$$;

revoke all on function public.export_planner_backup() from public, anon;
revoke all on function public.import_planner_backup(jsonb) from public, anon;
grant execute on function public.export_planner_backup() to authenticated;
grant execute on function public.import_planner_backup(jsonb) to authenticated;
