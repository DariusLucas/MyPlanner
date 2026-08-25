create or replace function public.set_task_completed(
  p_task_id uuid,
  p_expected_revision bigint,
  p_completed boolean
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
  select * into task_value
  from public.tasks
  where id = p_task_id and user_id = user_id_value
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'That task no longer exists.');
  end if;
  if p_completed and task_value.status = 'completed' then
    return jsonb_build_object('ok', true, 'task', to_jsonb(task_value), 'idempotent', true);
  end if;
  if not p_completed and task_value.status <> 'completed' then
    return jsonb_build_object('ok', true, 'task', to_jsonb(task_value), 'idempotent', true);
  end if;
  if task_value.revision <> p_expected_revision then
    return jsonb_build_object(
      'ok', false,
      'code', 'stale',
      'current_revision', task_value.revision,
      'task', to_jsonb(task_value)
    );
  end if;

  update public.tasks
  set status = case when p_completed then 'completed' else 'not_started' end,
      completed_at = case when p_completed then occurred_at_value else null end,
      revision = revision + 1
  where id = p_task_id
  returning * into task_value;

  insert into public.task_events (user_id, task_id, kind, occurred_at)
  values (
    user_id_value,
    p_task_id,
    case when p_completed then 'completed' else 'reopened' end,
    occurred_at_value
  );

  return jsonb_build_object('ok', true, 'task', to_jsonb(task_value), 'idempotent', false);
end;
$$;

create or replace function public.update_planned_task(
  p_task_id uuid,
  p_expected_revision bigint,
  p_input jsonb,
  p_recurrence_count integer default null
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
  recurrence_value public.task_recurrences%rowtype;
  old_date date;
  next_date date := (p_input->>'date')::date;
  anytime_week_value date := nullif(p_input->>'anytime_week_start', '')::date;
  title_value text := pg_catalog.btrim(coalesce(p_input->>'title', ''));
  category_value text := p_input->>'category';
  priority_value text := coalesce(nullif(p_input->>'priority', ''), 'normal');
  description_value text := nullif(p_input->>'description', '');
  estimated_minutes_value integer := nullif(p_input->>'estimated_minutes', '')::integer;
  next_position integer;
  recurrence_id_value uuid;
  recurrence_week_value date;
begin
  select * into task_value
  from public.tasks
  where id = p_task_id and user_id = user_id_value
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'That task no longer exists.');
  end if;
  if task_value.revision <> p_expected_revision then
    return jsonb_build_object(
      'ok', false,
      'code', 'stale',
      'current_revision', task_value.revision,
      'task', to_jsonb(task_value)
    );
  end if;
  if title_value = '' or char_length(title_value) > 200 then
    raise exception 'Task title must contain 1 to 200 characters.' using errcode = '22023';
  end if;
  if category_value not in ('career', 'content', 'other') then
    raise exception 'Invalid task category.' using errcode = '22023';
  end if;
  if priority_value not in ('high', 'normal', 'low') then
    raise exception 'Invalid task priority.' using errcode = '22023';
  end if;
  if p_recurrence_count is not null and p_recurrence_count not between 1 and 7 then
    raise exception 'Recurrence count must be between one and seven.' using errcode = '22023';
  end if;
  if p_recurrence_count is not null and anytime_week_value is null then
    raise exception 'Weekly recurrence is available for Anytime tasks only.' using errcode = '22023';
  end if;

  old_date := task_value.date;
  perform private.lock_task_lane(user_id_value, old_date);

  if task_value.recurrence_id is not null then
    select * into recurrence_value
    from public.task_recurrences
    where id = task_value.recurrence_id and user_id = user_id_value
    for update;

    if p_recurrence_count is null then
      update public.task_recurrences
      set active = false, revision = revision + 1
      where id = task_value.recurrence_id;

      delete from public.tasks
      where user_id = user_id_value
        and recurrence_id = task_value.recurrence_id
        and id <> task_value.id
        and status not in ('completed', 'skipped');

      if next_date <> old_date then
        perform private.lock_task_lane(user_id_value, next_date);
        select coalesce(max(position), -1) + 1 into next_position
        from public.tasks where user_id = user_id_value and date = next_date;
      else
        next_position := task_value.position;
      end if;

      update public.tasks
      set title = title_value,
          description = description_value,
          category = category_value,
          date = next_date,
          anytime_week_start = anytime_week_value,
          recurrence_id = null,
          recurrence_week_start = null,
          recurrence_index = null,
          priority = priority_value,
          estimated_minutes = estimated_minutes_value,
          position = next_position,
          revision = revision + 1
      where id = task_value.id
      returning * into task_value;
    else
      recurrence_week_value := coalesce(task_value.recurrence_week_start, anytime_week_value);

      update public.task_recurrences
      set title = title_value,
          description = description_value,
          category = category_value,
          priority = priority_value,
          estimated_minutes = estimated_minutes_value,
          count_per_week = p_recurrence_count,
          active = true,
          revision = revision + 1
      where id = task_value.recurrence_id
      returning * into recurrence_value;

      update public.tasks
      set title = title_value,
          description = description_value,
          category = category_value,
          priority = priority_value,
          estimated_minutes = estimated_minutes_value,
          revision = revision + 1
      where user_id = user_id_value
        and recurrence_id = task_value.recurrence_id
        and status not in ('completed', 'skipped');

      update public.tasks
      set date = recurrence_week_value,
          anytime_week_start = recurrence_week_value,
          revision = revision + 1
      where id = task_value.id
      returning * into task_value;
    end if;
  elsif p_recurrence_count is not null then
    recurrence_id_value := gen_random_uuid();
    insert into public.task_recurrences (
      id, user_id, title, description, category, priority,
      estimated_minutes, count_per_week, start_week, active
    ) values (
      recurrence_id_value,
      user_id_value,
      title_value,
      description_value,
      category_value,
      priority_value,
      estimated_minutes_value,
      p_recurrence_count,
      anytime_week_value,
      true
    ) returning * into recurrence_value;

    if anytime_week_value <> old_date then
      perform private.lock_task_lane(user_id_value, anytime_week_value);
      select coalesce(max(position), -1) + 1 into next_position
      from public.tasks where user_id = user_id_value and date = anytime_week_value;
    else
      next_position := task_value.position;
    end if;

    update public.tasks
    set title = title_value,
        description = description_value,
        category = category_value,
        date = anytime_week_value,
        anytime_week_start = anytime_week_value,
        recurrence_id = recurrence_id_value,
        recurrence_week_start = anytime_week_value,
        recurrence_index = 0,
        priority = priority_value,
        estimated_minutes = estimated_minutes_value,
        position = next_position,
        revision = revision + 1
    where id = task_value.id
    returning * into task_value;
  else
    if next_date <> old_date then
      perform private.lock_task_lane(user_id_value, next_date);
      select coalesce(max(position), -1) + 1 into next_position
      from public.tasks where user_id = user_id_value and date = next_date;
    else
      next_position := task_value.position;
    end if;

    update public.tasks
    set title = title_value,
        description = description_value,
        category = category_value,
        date = next_date,
        anytime_week_start = anytime_week_value,
        priority = priority_value,
        estimated_minutes = estimated_minutes_value,
        position = next_position,
        revision = revision + 1
    where id = task_value.id
    returning * into task_value;
  end if;

  if task_value.date <> old_date then
    perform private.normalize_task_positions(user_id_value, old_date);
  end if;

  return jsonb_build_object(
    'ok', true,
    'task', to_jsonb(task_value),
    'recurrence', case when recurrence_value.id is null then null else to_jsonb(recurrence_value) end
  );
end;
$$;

revoke all on function public.set_task_completed(uuid, bigint, boolean) from public, anon;
revoke all on function public.update_planned_task(uuid, bigint, jsonb, integer) from public, anon;

grant execute on function public.set_task_completed(uuid, bigint, boolean) to authenticated;
grant execute on function public.update_planned_task(uuid, bigint, jsonb, integer) to authenticated;
