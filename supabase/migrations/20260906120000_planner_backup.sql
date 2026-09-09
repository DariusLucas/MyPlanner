create or replace function private.validate_backup_array(
  p_data jsonb,
  p_key text,
  p_allowed_keys text[]
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  payload jsonb := p_data -> p_key;
  item jsonb;
  unknown_key text;
begin
  if payload is null or jsonb_typeof(payload) <> 'array' then
    raise exception 'Backup field "%" must be an array.', p_key using errcode = '22023';
  end if;
  if jsonb_array_length(payload) > 100000 then
    raise exception 'Backup field "%" contains too many records.', p_key using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(payload)
  loop
    if jsonb_typeof(item) <> 'object' then
      raise exception 'Every record in backup field "%" must be an object.', p_key using errcode = '22023';
    end if;
    if item ? 'user_id' then
      raise exception 'Backup records must not contain user ownership fields.' using errcode = '22023';
    end if;
    select key into unknown_key
    from jsonb_object_keys(item) as key
    where not (key = any(p_allowed_keys))
    limit 1;
    if unknown_key is not null then
      raise exception 'Backup field "%" contains unsupported property "%".', p_key, unknown_key using errcode = '22023';
    end if;
  end loop;

  return payload;
end;
$$;

revoke all on function private.validate_backup_array(jsonb, text, text[]) from public, anon, authenticated;

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
    'schemaVersion', 1,
    'ownerId', user_id_value,
    'exportedAt', now(),
    'plannerTimezone', coalesce(
      (select timezone from public.app_settings where user_id = user_id_value),
      'Europe/Bucharest'
    ),
    'data', jsonb_build_object(
      'app_settings', coalesce((
        select jsonb_agg(to_jsonb(item) - 'user_id' order by item.user_id)
        from public.app_settings as item where item.user_id = user_id_value
      ), '[]'::jsonb),
      'goals', coalesce((
        select jsonb_agg(to_jsonb(item) - 'user_id' order by item.id)
        from public.goals as item where item.user_id = user_id_value
      ), '[]'::jsonb),
      'sprints', coalesce((
        select jsonb_agg(to_jsonb(item) - 'user_id' order by item.id)
        from public.sprints as item where item.user_id = user_id_value
      ), '[]'::jsonb),
      'sprint_weeks', coalesce((
        select jsonb_agg(to_jsonb(item) - 'user_id' order by item.start_date, item.id)
        from public.sprint_weeks as item where item.user_id = user_id_value
      ), '[]'::jsonb),
      'weekly_targets', coalesce((
        select jsonb_agg(to_jsonb(item) - 'user_id' order by item.id)
        from public.weekly_targets as item where item.user_id = user_id_value
      ), '[]'::jsonb),
      'daily_focus', coalesce((
        select jsonb_agg(to_jsonb(item) - 'user_id' order by item.date, item.id)
        from public.daily_focus as item where item.user_id = user_id_value
      ), '[]'::jsonb),
      'task_recurrences', coalesce((
        select jsonb_agg(to_jsonb(item) - 'user_id' order by item.start_week, item.id)
        from public.task_recurrences as item where item.user_id = user_id_value
      ), '[]'::jsonb),
      'tasks', coalesce((
        select jsonb_agg(to_jsonb(item) - 'user_id' order by item.date, item.position, item.id)
        from public.tasks as item where item.user_id = user_id_value
      ), '[]'::jsonb),
      'content_milestones', coalesce((
        select jsonb_agg(to_jsonb(item) - 'user_id' order by item.created_at, item.id)
        from public.content_milestones as item where item.user_id = user_id_value
      ), '[]'::jsonb),
      'quick_thoughts', coalesce((
        select jsonb_agg(to_jsonb(item) - 'user_id' order by item.created_at, item.id)
        from public.quick_thoughts as item where item.user_id = user_id_value
      ), '[]'::jsonb),
      'task_events', coalesce((
        select jsonb_agg(to_jsonb(item) - 'user_id' order by item.occurred_at, item.id)
        from public.task_events as item where item.user_id = user_id_value
      ), '[]'::jsonb)
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
  key_value text;
  owner_id_value uuid;
  exported_at_value timestamptz;
  imported_counts jsonb;
begin
  if p_backup is null or jsonb_typeof(p_backup) <> 'object' then
    raise exception 'Backup must be a JSON object.' using errcode = '22023';
  end if;
  for key_value in select key from jsonb_object_keys(p_backup) as key
  loop
    if key_value <> all(array['format', 'schemaVersion', 'ownerId', 'exportedAt', 'plannerTimezone', 'data']) then
      raise exception 'Backup contains unsupported top-level property "%".', key_value using errcode = '22023';
    end if;
  end loop;
  if p_backup->>'format' <> 'myplanner.supabase' then
    raise exception 'This is not a MyPlanner Supabase backup.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_backup->'schemaVersion') <> 'number' or (p_backup->>'schemaVersion')::integer <> 1 then
    raise exception 'Unsupported backup schema version.' using errcode = '22023';
  end if;
  owner_id_value := (p_backup->>'ownerId')::uuid;
  if owner_id_value <> user_id_value then
    raise exception 'This backup belongs to a different Planner account.' using errcode = '42501';
  end if;
  exported_at_value := (p_backup->>'exportedAt')::timestamptz;
  if exported_at_value > now() + interval '1 day' then
    raise exception 'Backup export timestamp is invalid.' using errcode = '22023';
  end if;
  if coalesce(char_length(p_backup->>'plannerTimezone'), 0) not between 1 and 100 then
    raise exception 'Backup planner timezone is invalid.' using errcode = '22023';
  end if;

  data_value := p_backup->'data';
  if data_value is null or jsonb_typeof(data_value) <> 'object' then
    raise exception 'Backup data must be a JSON object.' using errcode = '22023';
  end if;
  for key_value in select key from jsonb_object_keys(data_value) as key
  loop
    if key_value <> all(array[
      'app_settings', 'goals', 'sprints', 'sprint_weeks', 'weekly_targets',
      'daily_focus', 'task_recurrences', 'tasks', 'content_milestones',
      'quick_thoughts', 'task_events'
    ]) then
      raise exception 'Backup contains unsupported data collection "%".', key_value using errcode = '22023';
    end if;
  end loop;

  drop table if exists pg_temp.planner_backup_app_settings;
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
  select user_id_value, item.*
  from jsonb_to_recordset(private.validate_backup_array(data_value, 'app_settings', array[
    'name', 'theme', 'week_starts_on', 'default_career_target_days',
    'default_weekly_applications', 'default_weekly_content', 'timezone',
    'revision', 'created_at', 'updated_at'
  ])) as item(
    name text, theme text, week_starts_on integer, default_career_target_days integer,
    default_weekly_applications integer, default_weekly_content integer,
    timezone text, revision bigint, created_at timestamptz, updated_at timestamptz
  );
  if (select count(*) from pg_temp.planner_backup_app_settings) <> 1 then
    raise exception 'Backup must contain exactly one app settings record.' using errcode = '22023';
  end if;
  if (select timezone from pg_temp.planner_backup_app_settings) <> p_backup->>'plannerTimezone' then
    raise exception 'Backup timezone metadata does not match app settings.' using errcode = '22023';
  end if;

  insert into pg_temp.planner_backup_goals
  select item.id, user_id_value, item.title, item.description, item.category,
    item.start_date, item.target_date, item.status, item.revision, item.created_at, item.updated_at
  from jsonb_to_recordset(private.validate_backup_array(data_value, 'goals', array[
    'id', 'title', 'description', 'category', 'start_date', 'target_date', 'status',
    'revision', 'created_at', 'updated_at'
  ])) as item(
    id uuid, title text, description text, category text, start_date date,
    target_date date, status text, revision bigint, created_at timestamptz, updated_at timestamptz
  );

  insert into pg_temp.planner_backup_sprints
  select item.id, user_id_value, item.title, item.start_date, item.end_date,
    item.status, item.revision, item.created_at, item.updated_at
  from jsonb_to_recordset(private.validate_backup_array(data_value, 'sprints', array[
    'id', 'title', 'start_date', 'end_date', 'status', 'revision', 'created_at', 'updated_at'
  ])) as item(
    id uuid, title text, start_date date, end_date date, status text,
    revision bigint, created_at timestamptz, updated_at timestamptz
  );

  insert into pg_temp.planner_backup_sprint_weeks
  select item.id, user_id_value, item.sprint_id, item.week_number, item.title,
    item.theme, item.outcome, item.start_date, item.end_date, item.revision,
    item.created_at, item.updated_at
  from jsonb_to_recordset(private.validate_backup_array(data_value, 'sprint_weeks', array[
    'id', 'sprint_id', 'week_number', 'title', 'theme', 'outcome', 'start_date',
    'end_date', 'revision', 'created_at', 'updated_at'
  ])) as item(
    id uuid, sprint_id uuid, week_number integer, title text, theme text,
    outcome text, start_date date, end_date date, revision bigint,
    created_at timestamptz, updated_at timestamptz
  );

  insert into pg_temp.planner_backup_weekly_targets
  select item.id, user_id_value, item.sprint_week_id, item.category, item.key,
    item.label, item.target_value, item.revision, item.created_at, item.updated_at
  from jsonb_to_recordset(private.validate_backup_array(data_value, 'weekly_targets', array[
    'id', 'sprint_week_id', 'category', 'key', 'label', 'target_value',
    'revision', 'created_at', 'updated_at'
  ])) as item(
    id uuid, sprint_week_id uuid, category text, key text, label text,
    target_value integer, revision bigint, created_at timestamptz, updated_at timestamptz
  );

  insert into pg_temp.planner_backup_daily_focus
  select item.id, user_id_value, item.date, item.career_mission, item.content_mission,
    item.revision, item.created_at, item.updated_at
  from jsonb_to_recordset(private.validate_backup_array(data_value, 'daily_focus', array[
    'id', 'date', 'career_mission', 'content_mission', 'revision', 'created_at', 'updated_at'
  ])) as item(
    id uuid, date date, career_mission text, content_mission text,
    revision bigint, created_at timestamptz, updated_at timestamptz
  );

  insert into pg_temp.planner_backup_task_recurrences
  select item.id, user_id_value, item.title, item.description, item.category,
    item.priority, item.estimated_minutes, item.count_per_week, item.start_week,
    item.active, item.revision, item.created_at, item.updated_at
  from jsonb_to_recordset(private.validate_backup_array(data_value, 'task_recurrences', array[
    'id', 'title', 'description', 'category', 'priority', 'estimated_minutes',
    'count_per_week', 'start_week', 'active', 'revision', 'created_at', 'updated_at'
  ])) as item(
    id uuid, title text, description text, category text, priority text,
    estimated_minutes integer, count_per_week integer, start_week date,
    active boolean, revision bigint, created_at timestamptz, updated_at timestamptz
  );

  insert into pg_temp.planner_backup_tasks
  select item.id, user_id_value, item.title, item.description, item.category,
    item.goal_id, item.sprint_id, item.sprint_week_id, item.date,
    item.anytime_week_start, item.recurrence_id, item.recurrence_week_start,
    item.recurrence_index, item.priority, item.status, item.position,
    item.estimated_minutes, item.completed_at, item.revision, item.created_at, item.updated_at
  from jsonb_to_recordset(private.validate_backup_array(data_value, 'tasks', array[
    'id', 'title', 'description', 'category', 'goal_id', 'sprint_id',
    'sprint_week_id', 'date', 'anytime_week_start', 'recurrence_id',
    'recurrence_week_start', 'recurrence_index', 'priority', 'status', 'position',
    'estimated_minutes', 'completed_at', 'revision', 'created_at', 'updated_at'
  ])) as item(
    id uuid, title text, description text, category text, goal_id uuid,
    sprint_id uuid, sprint_week_id uuid, date date, anytime_week_start date,
    recurrence_id uuid, recurrence_week_start date, recurrence_index integer,
    priority text, status text, position integer, estimated_minutes integer,
    completed_at timestamptz, revision bigint, created_at timestamptz, updated_at timestamptz
  );

  insert into pg_temp.planner_backup_content_milestones
  select item.id, user_id_value, item.category, item.label, item.type,
    item.target_value, item.achieved_at, item.revision, item.created_at, item.updated_at
  from jsonb_to_recordset(private.validate_backup_array(data_value, 'content_milestones', array[
    'id', 'category', 'label', 'type', 'target_value', 'achieved_at',
    'revision', 'created_at', 'updated_at'
  ])) as item(
    id uuid, category text, label text, type text, target_value integer,
    achieved_at timestamptz, revision bigint, created_at timestamptz, updated_at timestamptz
  );

  insert into pg_temp.planner_backup_quick_thoughts
  select item.id, user_id_value, item.text, item.revision, item.created_at, item.updated_at
  from jsonb_to_recordset(private.validate_backup_array(data_value, 'quick_thoughts', array[
    'id', 'text', 'revision', 'created_at', 'updated_at'
  ])) as item(
    id uuid, text text, revision bigint, created_at timestamptz, updated_at timestamptz
  );

  insert into pg_temp.planner_backup_task_events
  select item.id, user_id_value, item.task_id, item.kind, item.occurred_at, item.created_at
  from jsonb_to_recordset(private.validate_backup_array(data_value, 'task_events', array[
    'id', 'task_id', 'kind', 'occurred_at', 'created_at'
  ])) as item(
    id uuid, task_id uuid, kind text, occurred_at timestamptz, created_at timestamptz
  );

  if exists (
    select 1 from pg_temp.planner_backup_sprint_weeks as child
    left join pg_temp.planner_backup_sprints as parent on parent.id = child.sprint_id
    where parent.id is null
  ) or exists (
    select 1 from pg_temp.planner_backup_weekly_targets as child
    left join pg_temp.planner_backup_sprint_weeks as parent on parent.id = child.sprint_week_id
    where parent.id is null
  ) or exists (
    select 1 from pg_temp.planner_backup_tasks as child
    left join pg_temp.planner_backup_goals as parent on parent.id = child.goal_id
    where child.goal_id is not null and parent.id is null
  ) or exists (
    select 1 from pg_temp.planner_backup_tasks as child
    left join pg_temp.planner_backup_sprints as parent on parent.id = child.sprint_id
    where child.sprint_id is not null and parent.id is null
  ) or exists (
    select 1 from pg_temp.planner_backup_tasks as child
    left join pg_temp.planner_backup_sprint_weeks as parent on parent.id = child.sprint_week_id
    where child.sprint_week_id is not null and parent.id is null
  ) or exists (
    select 1 from pg_temp.planner_backup_tasks as child
    left join pg_temp.planner_backup_task_recurrences as parent on parent.id = child.recurrence_id
    where child.recurrence_id is not null and parent.id is null
  ) or exists (
    select 1 from pg_temp.planner_backup_task_events as child
    left join pg_temp.planner_backup_tasks as parent on parent.id = child.task_id
    where parent.id is null
  ) then
    raise exception 'Backup contains broken planner relationships.' using errcode = '23503';
  end if;

  imported_counts := jsonb_build_object(
    'app_settings', (select count(*) from pg_temp.planner_backup_app_settings),
    'goals', (select count(*) from pg_temp.planner_backup_goals),
    'sprints', (select count(*) from pg_temp.planner_backup_sprints),
    'sprint_weeks', (select count(*) from pg_temp.planner_backup_sprint_weeks),
    'weekly_targets', (select count(*) from pg_temp.planner_backup_weekly_targets),
    'daily_focus', (select count(*) from pg_temp.planner_backup_daily_focus),
    'task_recurrences', (select count(*) from pg_temp.planner_backup_task_recurrences),
    'tasks', (select count(*) from pg_temp.planner_backup_tasks),
    'content_milestones', (select count(*) from pg_temp.planner_backup_content_milestones),
    'quick_thoughts', (select count(*) from pg_temp.planner_backup_quick_thoughts),
    'task_events', (select count(*) from pg_temp.planner_backup_task_events)
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
  delete from public.app_settings where user_id = user_id_value;

  insert into public.app_settings select * from pg_temp.planner_backup_app_settings;
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

  return jsonb_build_object(
    'ok', true,
    'schemaVersion', 1,
    'importedAt', now(),
    'counts', imported_counts
  );
end;
$$;

revoke all on function public.export_planner_backup() from public, anon;
revoke all on function public.import_planner_backup(jsonb) from public, anon;
grant execute on function public.export_planner_backup() to authenticated;
grant execute on function public.import_planner_backup(jsonb) to authenticated;
