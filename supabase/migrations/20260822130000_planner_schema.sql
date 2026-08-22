create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;

create or replace function public.bump_revision()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.revision = old.revision + 1;
  return new;
end;
$$;

revoke all on function public.bump_revision() from public, anon, authenticated;

create table public.app_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'My Planner' check (char_length(name) between 1 and 120),
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  week_starts_on integer not null default 1 check (week_starts_on between 0 and 6),
  default_career_target_days integer not null default 5 check (default_career_target_days between 0 and 7),
  default_weekly_applications integer not null default 10 check (default_weekly_applications >= 0),
  default_weekly_content integer not null default 3 check (default_weekly_content >= 0),
  timezone text not null default 'Europe/Bucharest' check (char_length(timezone) between 1 and 100),
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text check (description is null or char_length(description) <= 2000),
  category text not null check (category in ('career', 'content', 'other')),
  start_date date not null,
  target_date date,
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'archived')),
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint goals_user_id_id_key unique (user_id, id),
  constraint goals_target_after_start check (target_date is null or target_date >= start_date)
);

create table public.sprints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  start_date date not null,
  end_date date not null,
  status text not null default 'planned' check (status in ('planned', 'active', 'completed', 'archived')),
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sprints_user_id_id_key unique (user_id, id),
  constraint sprints_dates_valid check (end_date >= start_date)
);

create table public.sprint_weeks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sprint_id uuid not null,
  week_number integer not null check (week_number > 0),
  title text not null check (char_length(title) between 1 and 200),
  theme text check (theme is null or char_length(theme) <= 500),
  outcome text check (outcome is null or char_length(outcome) <= 2000),
  start_date date not null,
  end_date date not null,
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sprint_weeks_user_id_id_key unique (user_id, id),
  constraint sprint_weeks_user_sprint_week_key unique (user_id, sprint_id, week_number),
  constraint sprint_weeks_sprint_fk foreign key (user_id, sprint_id)
    references public.sprints(user_id, id) on delete cascade,
  constraint sprint_weeks_dates_valid check (end_date >= start_date)
);

create table public.weekly_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sprint_week_id uuid not null,
  category text not null check (category in ('career', 'content', 'other')),
  key text not null check (char_length(key) between 1 and 120),
  label text not null check (char_length(label) between 1 and 200),
  target_value integer not null check (target_value >= 0),
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weekly_targets_user_id_id_key unique (user_id, id),
  constraint weekly_targets_sprint_week_fk foreign key (user_id, sprint_week_id)
    references public.sprint_weeks(user_id, id) on delete cascade
);

create table public.daily_focus (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  career_mission text check (career_mission is null or char_length(career_mission) <= 500),
  content_mission text check (content_mission is null or char_length(content_mission) <= 500),
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_focus_user_id_id_key unique (user_id, id),
  constraint daily_focus_user_date_key unique (user_id, date)
);

create table public.task_recurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text check (description is null or char_length(description) <= 2000),
  category text not null check (category in ('career', 'content', 'other')),
  priority text not null default 'normal' check (priority in ('high', 'normal', 'low')),
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes between 1 and 1440),
  count_per_week integer not null check (count_per_week between 1 and 7),
  start_week date not null,
  active boolean not null default true,
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_recurrences_user_id_id_key unique (user_id, id)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text check (description is null or char_length(description) <= 2000),
  category text not null check (category in ('career', 'content', 'other')),
  goal_id uuid,
  sprint_id uuid,
  sprint_week_id uuid,
  date date not null,
  anytime_week_start date,
  recurrence_id uuid,
  recurrence_week_start date,
  recurrence_index integer,
  priority text not null default 'normal' check (priority in ('high', 'normal', 'low')),
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'on_hold', 'done', 'completed', 'skipped')),
  position integer not null default 0 check (position >= 0),
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes between 1 and 1440),
  completed_at timestamptz,
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_user_id_id_key unique (user_id, id),
  constraint tasks_goal_fk foreign key (goal_id)
    references public.goals(id) on delete set null,
  constraint tasks_sprint_fk foreign key (sprint_id)
    references public.sprints(id) on delete set null,
  constraint tasks_sprint_week_fk foreign key (sprint_week_id)
    references public.sprint_weeks(id) on delete set null,
  constraint tasks_recurrence_fk foreign key (recurrence_id)
    references public.task_recurrences(id) on delete cascade,
  constraint tasks_completion_consistent check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed' and completed_at is null)
  ),
  constraint tasks_recurrence_fields_consistent check (
    (recurrence_id is null and recurrence_week_start is null and recurrence_index is null)
    or (recurrence_id is not null and recurrence_week_start is not null and recurrence_index is not null and recurrence_index >= 0)
  ),
  constraint tasks_user_recurrence_instance_key unique
    (user_id, recurrence_id, recurrence_week_start, recurrence_index)
);

create table public.content_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null default 'content' check (category in ('career', 'content')),
  label text not null check (char_length(label) between 1 and 160),
  type text not null default 'custom'
    check (type in ('views', 'likes', 'followers', 'applications', 'interviews', 'offers', 'custom')),
  target_value integer check (target_value is null or target_value between 1 and 1000000000),
  achieved_at timestamptz,
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_milestones_user_id_id_key unique (user_id, id)
);

create table public.quick_thoughts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 1200),
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quick_thoughts_user_id_id_key unique (user_id, id)
);

create table public.task_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null,
  kind text not null check (kind in ('completed', 'reopened', 'skipped', 'restored')),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint task_events_task_fk foreign key (user_id, task_id)
    references public.tasks(user_id, id) on delete cascade
);

create index goals_user_status_idx on public.goals (user_id, status);
create index sprints_user_status_idx on public.sprints (user_id, status);
create index sprint_weeks_user_dates_idx on public.sprint_weeks (user_id, start_date, end_date);
create index weekly_targets_user_week_idx on public.weekly_targets (user_id, sprint_week_id);
create index task_recurrences_user_active_week_idx on public.task_recurrences (user_id, active, start_week);
create index tasks_user_date_status_idx on public.tasks (user_id, date, status);
create index tasks_user_completed_at_idx on public.tasks (user_id, completed_at);
create index tasks_user_category_status_idx on public.tasks (user_id, category, status);
create index tasks_user_anytime_status_idx on public.tasks (user_id, anytime_week_start, status);
create index tasks_user_date_position_idx on public.tasks (user_id, date, position, id);
create index content_milestones_user_achieved_idx on public.content_milestones (user_id, category, achieved_at);
create index quick_thoughts_user_created_idx on public.quick_thoughts (user_id, created_at);
create index task_events_user_task_occurred_idx on public.task_events (user_id, task_id, occurred_at);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'app_settings', 'goals', 'sprints', 'sprint_weeks', 'weekly_targets',
    'daily_focus', 'task_recurrences', 'tasks', 'content_milestones',
    'quick_thoughts'
  ] loop
    execute format(
      'create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name,
      table_name
    );
    execute format(
      'create trigger %I_bump_revision before update on public.%I for each row execute function public.bump_revision()',
      table_name,
      table_name
    );
  end loop;
end;
$$;
