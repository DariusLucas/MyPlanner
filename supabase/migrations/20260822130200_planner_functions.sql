create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.require_user_id()
returns uuid
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  result uuid := auth.uid();
begin
  if result is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  return result;
end;
$$;

create or replace function private.assert_task_parents(
  p_user_id uuid,
  p_goal_id uuid,
  p_sprint_id uuid,
  p_sprint_week_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  week_sprint_id uuid;
begin
  if p_goal_id is not null and not exists (
    select 1 from public.goals where id = p_goal_id and user_id = p_user_id
  ) then
    raise exception 'Goal does not belong to the authenticated user.' using errcode = '23503';
  end if;

  if p_sprint_id is not null and not exists (
    select 1 from public.sprints where id = p_sprint_id and user_id = p_user_id
  ) then
    raise exception 'Sprint does not belong to the authenticated user.' using errcode = '23503';
  end if;

  if p_sprint_week_id is not null then
    select sprint_id into week_sprint_id
    from public.sprint_weeks
    where id = p_sprint_week_id and user_id = p_user_id;

    if not found then
      raise exception 'Sprint week does not belong to the authenticated user.' using errcode = '23503';
    end if;

    if p_sprint_id is not null and week_sprint_id <> p_sprint_id then
      raise exception 'Sprint week does not belong to the selected sprint.' using errcode = '23503';
    end if;
  end if;
end;
$$;

create or replace function private.lock_task_lane(p_user_id uuid, p_date date)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  select pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text || ':' || p_date::text, 0)
  );
$$;

create or replace function private.normalize_task_positions(p_user_id uuid, p_date date)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  with ordered as (
    select id, (row_number() over (order by position, id) - 1)::integer as next_position
    from public.tasks
    where user_id = p_user_id and date = p_date
  )
  update public.tasks as task
  set position = ordered.next_position,
      revision = task.revision + 1
  from ordered
  where task.id = ordered.id
    and task.position <> ordered.next_position;
$$;

create or replace function public.create_task(p_input jsonb, p_client_task_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  user_id_value uuid := private.require_user_id();
  task_value public.tasks%rowtype;
  title_value text := pg_catalog.btrim(coalesce(p_input->>'title', ''));
  category_value text := p_input->>'category';
  date_value date := (p_input->>'date')::date;
  goal_value uuid := nullif(p_input->>'goal_id', '')::uuid;
  sprint_value uuid := nullif(p_input->>'sprint_id', '')::uuid;
  sprint_week_value uuid := nullif(p_input->>'sprint_week_id', '')::uuid;
  next_position integer;
begin
  if p_client_task_id is null then
    raise exception 'A client task id is required.' using errcode = '22023';
  end if;

  select * into task_value
  from public.tasks
  where id = p_client_task_id and user_id = user_id_value;
  if found then
    return jsonb_build_object('ok', true, 'task', to_jsonb(task_value), 'idempotent', true);
  end if;

  if title_value = '' or char_length(title_value) > 200 then
    raise exception 'Task title must contain 1 to 200 characters.' using errcode = '22023';
  end if;
  if category_value not in ('career', 'content', 'other') then
    raise exception 'Invalid task category.' using errcode = '22023';
  end if;

  perform private.assert_task_parents(user_id_value, goal_value, sprint_value, sprint_week_value);
  perform private.lock_task_lane(user_id_value, date_value);

  select coalesce(max(position), -1) + 1 into next_position
  from public.tasks
  where user_id = user_id_value and date = date_value;

  insert into public.tasks (
    id, user_id, title, description, category, goal_id, sprint_id,
    sprint_week_id, date, anytime_week_start, priority, position,
    estimated_minutes
  ) values (
    p_client_task_id,
    user_id_value,
    title_value,
    nullif(p_input->>'description', ''),
    category_value,
    goal_value,
    sprint_value,
    sprint_week_value,
    date_value,
    nullif(p_input->>'anytime_week_start', '')::date,
    coalesce(nullif(p_input->>'priority', ''), 'normal'),
    next_position,
    nullif(p_input->>'estimated_minutes', '')::integer
  )
  returning * into task_value;

  return jsonb_build_object('ok', true, 'task', to_jsonb(task_value), 'idempotent', false);
end;
$$;

create or replace function public.update_task(
  p_task_id uuid,
  p_expected_revision bigint,
  p_input jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  user_id_value uuid := private.require_user_id();
  task_value public.tasks%rowtype;
  old_date date;
  next_date date;
  next_goal uuid;
  next_sprint uuid;
  next_sprint_week uuid;
  next_title text;
  next_position integer;
begin
  select * into task_value
  from public.tasks
  where id = p_task_id and user_id = user_id_value
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'That task no longer exists.');
  end if;
  if task_value.revision <> p_expected_revision then
    return jsonb_build_object('ok', false, 'code', 'stale', 'current_revision', task_value.revision, 'task', to_jsonb(task_value));
  end if;

  old_date := task_value.date;
  next_date := case when p_input ? 'date' then (p_input->>'date')::date else task_value.date end;
  next_goal := case when p_input ? 'goal_id' then nullif(p_input->>'goal_id', '')::uuid else task_value.goal_id end;
  next_sprint := case when p_input ? 'sprint_id' then nullif(p_input->>'sprint_id', '')::uuid else task_value.sprint_id end;
  next_sprint_week := case when p_input ? 'sprint_week_id' then nullif(p_input->>'sprint_week_id', '')::uuid else task_value.sprint_week_id end;
  next_title := case when p_input ? 'title' then pg_catalog.btrim(p_input->>'title') else task_value.title end;

  if next_title = '' or char_length(next_title) > 200 then
    raise exception 'Task title must contain 1 to 200 characters.' using errcode = '22023';
  end if;

  perform private.assert_task_parents(user_id_value, next_goal, next_sprint, next_sprint_week);
  perform private.lock_task_lane(user_id_value, old_date);
  if next_date <> old_date then
    perform private.lock_task_lane(user_id_value, next_date);
    select coalesce(max(position), -1) + 1 into next_position
    from public.tasks where user_id = user_id_value and date = next_date;
  else
    next_position := task_value.position;
  end if;

  update public.tasks
  set title = next_title,
      description = case when p_input ? 'description' then nullif(p_input->>'description', '') else task_value.description end,
      category = case when p_input ? 'category' then p_input->>'category' else task_value.category end,
      goal_id = next_goal,
      sprint_id = next_sprint,
      sprint_week_id = next_sprint_week,
      date = next_date,
      anytime_week_start = case when p_input ? 'anytime_week_start' then nullif(p_input->>'anytime_week_start', '')::date else task_value.anytime_week_start end,
      priority = case when p_input ? 'priority' then p_input->>'priority' else task_value.priority end,
      estimated_minutes = case when p_input ? 'estimated_minutes' then nullif(p_input->>'estimated_minutes', '')::integer else task_value.estimated_minutes end,
      position = next_position,
      revision = revision + 1
  where id = p_task_id
  returning * into task_value;

  if next_date <> old_date then
    perform private.normalize_task_positions(user_id_value, old_date);
  end if;

  return jsonb_build_object('ok', true, 'task', to_jsonb(task_value));
end;
$$;

create or replace function public.move_task_to_tomorrow(
  p_task_id uuid,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  user_id_value uuid := private.require_user_id();
  task_value public.tasks%rowtype;
  old_date date;
  next_date date;
  next_position integer;
begin
  select * into task_value from public.tasks
  where id = p_task_id and user_id = user_id_value for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'That task no longer exists.');
  end if;
  if task_value.status = 'completed' then
    return jsonb_build_object('ok', false, 'code', 'invalid_state', 'message', 'Completed tasks stay on their original date.');
  end if;
  if task_value.revision <> p_expected_revision then
    return jsonb_build_object('ok', false, 'code', 'stale', 'current_revision', task_value.revision, 'task', to_jsonb(task_value));
  end if;

  old_date := task_value.date;
  next_date := old_date + 1;
  perform private.lock_task_lane(user_id_value, old_date);
  perform private.lock_task_lane(user_id_value, next_date);
  select coalesce(max(position), -1) + 1 into next_position
  from public.tasks where user_id = user_id_value and date = next_date;

  update public.tasks
  set date = next_date, position = next_position, revision = revision + 1
  where id = p_task_id returning * into task_value;
  perform private.normalize_task_positions(user_id_value, old_date);
  return jsonb_build_object('ok', true, 'task', to_jsonb(task_value));
end;
$$;

create or replace function public.reorder_task(
  p_task_id uuid,
  p_expected_revision bigint,
  p_direction text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  user_id_value uuid := private.require_user_id();
  task_value public.tasks%rowtype;
  neighbor_value public.tasks%rowtype;
begin
  if p_direction not in ('up', 'down') then
    raise exception 'Direction must be up or down.' using errcode = '22023';
  end if;

  select * into task_value from public.tasks
  where id = p_task_id and user_id = user_id_value for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'That task no longer exists.');
  end if;
  if task_value.revision <> p_expected_revision then
    return jsonb_build_object('ok', false, 'code', 'stale', 'current_revision', task_value.revision, 'task', to_jsonb(task_value));
  end if;

  perform private.lock_task_lane(user_id_value, task_value.date);
  perform private.normalize_task_positions(user_id_value, task_value.date);
  select * into task_value from public.tasks where id = p_task_id for update;

  if p_direction = 'up' then
    select * into neighbor_value from public.tasks
    where user_id = user_id_value and date = task_value.date
      and category = task_value.category and position < task_value.position
    order by position desc, id desc limit 1 for update;
  else
    select * into neighbor_value from public.tasks
    where user_id = user_id_value and date = task_value.date
      and category = task_value.category and position > task_value.position
    order by position asc, id asc limit 1 for update;
  end if;

  if not found then
    return jsonb_build_object('ok', true, 'task', to_jsonb(task_value), 'unchanged', true);
  end if;

  update public.tasks
  set position = case when id = task_value.id then neighbor_value.position else task_value.position end,
      revision = revision + 1
  where id in (task_value.id, neighbor_value.id);

  select * into task_value from public.tasks where id = p_task_id;
  return jsonb_build_object('ok', true, 'task', to_jsonb(task_value), 'unchanged', false);
end;
$$;

create or replace function public.set_task_workflow(
  p_task_id uuid,
  p_expected_revision bigint,
  p_status text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  user_id_value uuid := private.require_user_id();
  task_value public.tasks%rowtype;
begin
  if p_status not in ('not_started', 'in_progress', 'on_hold', 'done') then
    raise exception 'Invalid workflow state.' using errcode = '22023';
  end if;
  select * into task_value from public.tasks
  where id = p_task_id and user_id = user_id_value for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'That task no longer exists.');
  end if;
  if task_value.status = p_status and task_value.completed_at is null then
    return jsonb_build_object('ok', true, 'task', to_jsonb(task_value), 'idempotent', true);
  end if;
  if task_value.revision <> p_expected_revision then
    return jsonb_build_object('ok', false, 'code', 'stale', 'current_revision', task_value.revision, 'task', to_jsonb(task_value));
  end if;

  update public.tasks
  set status = p_status, completed_at = null, revision = revision + 1
  where id = p_task_id returning * into task_value;
  return jsonb_build_object('ok', true, 'task', to_jsonb(task_value), 'idempotent', false);
end;
$$;

create or replace function public.complete_task(
  p_task_id uuid,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  user_id_value uuid := private.require_user_id();
  task_value public.tasks%rowtype;
  occurred_at_value timestamptz := now();
begin
  select * into task_value from public.tasks
  where id = p_task_id and user_id = user_id_value for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'That task no longer exists.');
  end if;
  if task_value.status = 'completed' then
    return jsonb_build_object('ok', true, 'task', to_jsonb(task_value), 'idempotent', true);
  end if;
  if task_value.status <> 'done' then
    return jsonb_build_object('ok', false, 'code', 'invalid_state', 'message', 'Move the task to Done before confirming completion.');
  end if;
  if task_value.revision <> p_expected_revision then
    return jsonb_build_object('ok', false, 'code', 'stale', 'current_revision', task_value.revision, 'task', to_jsonb(task_value));
  end if;

  update public.tasks
  set status = 'completed', completed_at = occurred_at_value, revision = revision + 1
  where id = p_task_id returning * into task_value;
  insert into public.task_events (user_id, task_id, kind, occurred_at)
  values (user_id_value, p_task_id, 'completed', occurred_at_value);
  return jsonb_build_object('ok', true, 'task', to_jsonb(task_value), 'idempotent', false);
end;
$$;

create or replace function public.reopen_task(
  p_task_id uuid,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  user_id_value uuid := private.require_user_id();
  task_value public.tasks%rowtype;
  occurred_at_value timestamptz := now();
begin
  select * into task_value from public.tasks
  where id = p_task_id and user_id = user_id_value for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'That task no longer exists.');
  end if;
  if task_value.status <> 'completed' then
    return jsonb_build_object('ok', true, 'task', to_jsonb(task_value), 'idempotent', true);
  end if;
  if task_value.revision <> p_expected_revision then
    return jsonb_build_object('ok', false, 'code', 'stale', 'current_revision', task_value.revision, 'task', to_jsonb(task_value));
  end if;

  update public.tasks
  set status = 'not_started', completed_at = null, revision = revision + 1
  where id = p_task_id returning * into task_value;
  insert into public.task_events (user_id, task_id, kind, occurred_at)
  values (user_id_value, p_task_id, 'reopened', occurred_at_value);
  return jsonb_build_object('ok', true, 'task', to_jsonb(task_value), 'idempotent', false);
end;
$$;

create or replace function public.delete_task(
  p_task_id uuid,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  user_id_value uuid := private.require_user_id();
  task_value public.tasks%rowtype;
  recurrence_value uuid;
  task_date date;
begin
  select * into task_value from public.tasks
  where id = p_task_id and user_id = user_id_value for update;
  if not found then
    return jsonb_build_object('ok', true, 'deleted', true, 'idempotent', true);
  end if;
  if task_value.revision <> p_expected_revision then
    return jsonb_build_object('ok', false, 'code', 'stale', 'current_revision', task_value.revision, 'task', to_jsonb(task_value));
  end if;

  recurrence_value := task_value.recurrence_id;
  task_date := task_value.date;
  if recurrence_value is not null then
    update public.task_recurrences
    set active = false, revision = revision + 1
    where id = recurrence_value and user_id = user_id_value;
    delete from public.tasks
    where recurrence_id = recurrence_value and user_id = user_id_value
      and status not in ('completed', 'skipped');
  else
    delete from public.tasks where id = p_task_id;
  end if;
  perform private.normalize_task_positions(user_id_value, task_date);
  return jsonb_build_object('ok', true, 'deleted', true, 'idempotent', false);
end;
$$;

create or replace function public.save_daily_focus(
  p_date date,
  p_career_mission text,
  p_content_mission text,
  p_expected_revision bigint default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  user_id_value uuid := private.require_user_id();
  focus_value public.daily_focus%rowtype;
begin
  select * into focus_value from public.daily_focus
  where user_id = user_id_value and date = p_date for update;

  if not found then
    insert into public.daily_focus (user_id, date, career_mission, content_mission)
    values (user_id_value, p_date, nullif(pg_catalog.btrim(p_career_mission), ''), nullif(pg_catalog.btrim(p_content_mission), ''))
    returning * into focus_value;
    return jsonb_build_object('ok', true, 'focus', to_jsonb(focus_value), 'created', true);
  end if;

  if focus_value.career_mission is not distinct from nullif(pg_catalog.btrim(p_career_mission), '')
     and focus_value.content_mission is not distinct from nullif(pg_catalog.btrim(p_content_mission), '') then
    return jsonb_build_object('ok', true, 'focus', to_jsonb(focus_value), 'idempotent', true);
  end if;
  if p_expected_revision is null or focus_value.revision <> p_expected_revision then
    return jsonb_build_object('ok', false, 'code', 'stale', 'current_revision', focus_value.revision, 'focus', to_jsonb(focus_value));
  end if;

  update public.daily_focus
  set career_mission = nullif(pg_catalog.btrim(p_career_mission), ''),
      content_mission = nullif(pg_catalog.btrim(p_content_mission), ''),
      revision = revision + 1
  where id = focus_value.id returning * into focus_value;
  return jsonb_build_object('ok', true, 'focus', to_jsonb(focus_value), 'created', false);
end;
$$;

create or replace function public.create_or_update_recurrence(
  p_input jsonb,
  p_recurrence_id uuid default null,
  p_expected_revision bigint default null,
  p_client_recurrence_id uuid default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  user_id_value uuid := private.require_user_id();
  recurrence_value public.task_recurrences%rowtype;
  id_value uuid := coalesce(p_recurrence_id, p_client_recurrence_id, gen_random_uuid());
  title_value text := pg_catalog.btrim(coalesce(p_input->>'title', ''));
begin
  if title_value = '' or char_length(title_value) > 200 then
    raise exception 'Recurrence title must contain 1 to 200 characters.' using errcode = '22023';
  end if;

  select * into recurrence_value from public.task_recurrences
  where id = id_value and user_id = user_id_value for update;

  if p_recurrence_id is null then
    if found then
      return jsonb_build_object('ok', true, 'recurrence', to_jsonb(recurrence_value), 'idempotent', true);
    end if;
    insert into public.task_recurrences (
      id, user_id, title, description, category, priority,
      estimated_minutes, count_per_week, start_week, active
    ) values (
      id_value,
      user_id_value,
      title_value,
      nullif(p_input->>'description', ''),
      p_input->>'category',
      coalesce(nullif(p_input->>'priority', ''), 'normal'),
      nullif(p_input->>'estimated_minutes', '')::integer,
      (p_input->>'count_per_week')::integer,
      (p_input->>'start_week')::date,
      coalesce((p_input->>'active')::boolean, true)
    ) returning * into recurrence_value;
    return jsonb_build_object('ok', true, 'recurrence', to_jsonb(recurrence_value), 'created', true);
  end if;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'That recurrence no longer exists.');
  end if;
  if recurrence_value.revision <> p_expected_revision then
    return jsonb_build_object('ok', false, 'code', 'stale', 'current_revision', recurrence_value.revision, 'recurrence', to_jsonb(recurrence_value));
  end if;

  update public.task_recurrences
  set title = title_value,
      description = nullif(p_input->>'description', ''),
      category = p_input->>'category',
      priority = coalesce(nullif(p_input->>'priority', ''), 'normal'),
      estimated_minutes = nullif(p_input->>'estimated_minutes', '')::integer,
      count_per_week = (p_input->>'count_per_week')::integer,
      start_week = (p_input->>'start_week')::date,
      active = coalesce((p_input->>'active')::boolean, recurrence_value.active),
      revision = revision + 1
  where id = id_value returning * into recurrence_value;

  update public.tasks
  set title = recurrence_value.title,
      description = recurrence_value.description,
      category = recurrence_value.category,
      priority = recurrence_value.priority,
      estimated_minutes = recurrence_value.estimated_minutes,
      revision = revision + 1
  where user_id = user_id_value and recurrence_id = id_value
    and status not in ('completed', 'skipped');

  return jsonb_build_object('ok', true, 'recurrence', to_jsonb(recurrence_value), 'created', false);
end;
$$;

create or replace function public.ensure_recurring_instances(p_week_start date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  user_id_value uuid := private.require_user_id();
  timezone_value text;
  today_value date;
  current_week_start date;
  recurrence_value public.task_recurrences%rowtype;
  index_value integer;
  next_position integer;
  created_count integer := 0;
  changed_task record;
begin
  select timezone into timezone_value from public.app_settings where user_id = user_id_value;
  timezone_value := coalesce(timezone_value, 'Europe/Bucharest');
  today_value := (now() at time zone timezone_value)::date;
  current_week_start := today_value - (extract(isodow from today_value)::integer - 1);

  if p_week_start <> current_week_start then
    return jsonb_build_object('ok', true, 'created', 0, 'ignored', true, 'current_week_start', current_week_start);
  end if;

  perform private.lock_task_lane(user_id_value, p_week_start);

  for recurrence_value in
    select * from public.task_recurrences
    where user_id = user_id_value and active and start_week <= p_week_start
    order by id for update
  loop
    for changed_task in
      update public.tasks
      set status = 'skipped', completed_at = null, revision = revision + 1
      where user_id = user_id_value
        and recurrence_id = recurrence_value.id
        and recurrence_week_start < p_week_start
        and status not in ('completed', 'skipped')
      returning id
    loop
      insert into public.task_events (user_id, task_id, kind, occurred_at)
      values (user_id_value, changed_task.id, 'skipped', now());
    end loop;

    for changed_task in
      update public.tasks
      set status = 'not_started', completed_at = null, revision = revision + 1
      where user_id = user_id_value
        and recurrence_id = recurrence_value.id
        and recurrence_week_start = p_week_start
        and recurrence_index < recurrence_value.count_per_week
        and status = 'skipped'
      returning id
    loop
      insert into public.task_events (user_id, task_id, kind, occurred_at)
      values (user_id_value, changed_task.id, 'restored', now());
    end loop;

    for changed_task in
      update public.tasks
      set status = 'skipped', completed_at = null, revision = revision + 1
      where user_id = user_id_value
        and recurrence_id = recurrence_value.id
        and recurrence_week_start = p_week_start
        and recurrence_index >= recurrence_value.count_per_week
        and status not in ('completed', 'skipped')
      returning id
    loop
      insert into public.task_events (user_id, task_id, kind, occurred_at)
      values (user_id_value, changed_task.id, 'skipped', now());
    end loop;

    select coalesce(max(position), -1) + 1 into next_position
    from public.tasks where user_id = user_id_value and date = p_week_start;

    for index_value in 0..(recurrence_value.count_per_week - 1) loop
      insert into public.tasks (
        user_id, title, description, category, date, anytime_week_start,
        recurrence_id, recurrence_week_start, recurrence_index, priority,
        position, estimated_minutes
      ) values (
        user_id_value,
        recurrence_value.title,
        recurrence_value.description,
        recurrence_value.category,
        p_week_start,
        p_week_start,
        recurrence_value.id,
        p_week_start,
        index_value,
        recurrence_value.priority,
        next_position + index_value,
        recurrence_value.estimated_minutes
      )
      on conflict (user_id, recurrence_id, recurrence_week_start, recurrence_index) do nothing;
      if found then
        created_count := created_count + 1;
      end if;
    end loop;
  end loop;

  return jsonb_build_object('ok', true, 'created', created_count, 'ignored', false, 'current_week_start', current_week_start);
end;
$$;

create or replace function public.delete_or_deactivate_recurrence(
  p_recurrence_id uuid,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  user_id_value uuid := private.require_user_id();
  recurrence_value public.task_recurrences%rowtype;
begin
  select * into recurrence_value from public.task_recurrences
  where id = p_recurrence_id and user_id = user_id_value for update;
  if not found then
    return jsonb_build_object('ok', true, 'deactivated', true, 'idempotent', true);
  end if;
  if not recurrence_value.active then
    return jsonb_build_object('ok', true, 'recurrence', to_jsonb(recurrence_value), 'deactivated', true, 'idempotent', true);
  end if;
  if recurrence_value.revision <> p_expected_revision then
    return jsonb_build_object('ok', false, 'code', 'stale', 'current_revision', recurrence_value.revision, 'recurrence', to_jsonb(recurrence_value));
  end if;

  update public.task_recurrences
  set active = false, revision = revision + 1
  where id = p_recurrence_id returning * into recurrence_value;
  delete from public.tasks
  where user_id = user_id_value and recurrence_id = p_recurrence_id
    and status not in ('completed', 'skipped');
  return jsonb_build_object('ok', true, 'recurrence', to_jsonb(recurrence_value), 'deactivated', true, 'idempotent', false);
end;
$$;

revoke all on function public.create_task(jsonb, uuid) from public, anon;
revoke all on function public.update_task(uuid, bigint, jsonb) from public, anon;
revoke all on function public.move_task_to_tomorrow(uuid, bigint) from public, anon;
revoke all on function public.reorder_task(uuid, bigint, text) from public, anon;
revoke all on function public.set_task_workflow(uuid, bigint, text) from public, anon;
revoke all on function public.complete_task(uuid, bigint) from public, anon;
revoke all on function public.reopen_task(uuid, bigint) from public, anon;
revoke all on function public.delete_task(uuid, bigint) from public, anon;
revoke all on function public.save_daily_focus(date, text, text, bigint) from public, anon;
revoke all on function public.create_or_update_recurrence(jsonb, uuid, bigint, uuid) from public, anon;
revoke all on function public.ensure_recurring_instances(date) from public, anon;
revoke all on function public.delete_or_deactivate_recurrence(uuid, bigint) from public, anon;

grant execute on function public.create_task(jsonb, uuid) to authenticated;
grant execute on function public.update_task(uuid, bigint, jsonb) to authenticated;
grant execute on function public.move_task_to_tomorrow(uuid, bigint) to authenticated;
grant execute on function public.reorder_task(uuid, bigint, text) to authenticated;
grant execute on function public.set_task_workflow(uuid, bigint, text) to authenticated;
grant execute on function public.complete_task(uuid, bigint) to authenticated;
grant execute on function public.reopen_task(uuid, bigint) to authenticated;
grant execute on function public.delete_task(uuid, bigint) to authenticated;
grant execute on function public.save_daily_focus(date, text, text, bigint) to authenticated;
grant execute on function public.create_or_update_recurrence(jsonb, uuid, bigint, uuid) to authenticated;
grant execute on function public.ensure_recurring_instances(date) to authenticated;
grant execute on function public.delete_or_deactivate_recurrence(uuid, bigint) to authenticated;
