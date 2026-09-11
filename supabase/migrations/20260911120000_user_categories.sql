create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(pg_catalog.btrim(name)) between 1 and 40),
  icon text not null default 'target' check (icon in (
    'briefcase', 'clapperboard', 'dumbbell', 'graduation-cap', 'heart', 'home',
    'book-open', 'code', 'palette', 'music', 'plane', 'wallet', 'people',
    'sprout', 'target', 'trophy', 'camera', 'bike', 'activity', 'coffee',
    'languages', 'lightbulb', 'microscope', 'paw-print'
  )),
  position integer not null default 0 check (position >= 0),
  archived_at timestamptz,
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_user_id_id_key unique (user_id, id)
);

create unique index categories_user_active_name_idx
  on public.categories (user_id, lower(pg_catalog.btrim(name)))
  where archived_at is null;
create index categories_user_position_idx
  on public.categories (user_id, archived_at, position, created_at);

create trigger categories_set_updated_at before update on public.categories
  for each row execute function public.set_updated_at();
create trigger categories_bump_revision before update on public.categories
  for each row execute function public.bump_revision();

alter table public.categories enable row level security;
revoke all on table public.categories from anon, authenticated;
grant select, insert, update on table public.categories to authenticated;

create policy categories_select_own on public.categories
  for select to authenticated using ((select auth.uid()) = user_id);
create policy categories_insert_own on public.categories
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy categories_update_own on public.categories
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter table public.tasks add column category_id uuid;
alter table public.task_recurrences add column category_id uuid;
alter table public.content_milestones add column category_id uuid;

with used_categories as (
  select user_id, category from public.tasks
  union
  select user_id, category from public.task_recurrences
  union
  select user_id, category from public.content_milestones
)
insert into public.categories (user_id, name, icon, position)
select
  used.user_id,
  case used.category when 'career' then 'Career' when 'content' then 'Content' else 'Personal' end,
  case used.category when 'career' then 'briefcase' when 'content' then 'clapperboard' else 'coffee' end,
  case used.category when 'career' then 0 when 'content' then 1 else 2 end
from used_categories as used
where not exists (
  select 1 from public.categories as existing
  where existing.user_id = used.user_id
    and lower(existing.name) = lower(case used.category when 'career' then 'Career' when 'content' then 'Content' else 'Personal' end)
    and existing.archived_at is null
);

update public.tasks as task
set category_id = category.id
from public.categories as category
where category.user_id = task.user_id
  and lower(category.name) = lower(case task.category when 'career' then 'Career' when 'content' then 'Content' else 'Personal' end)
  and category.archived_at is null;

update public.task_recurrences as recurrence
set category_id = category.id
from public.categories as category
where category.user_id = recurrence.user_id
  and lower(category.name) = lower(case recurrence.category when 'career' then 'Career' when 'content' then 'Content' else 'Personal' end)
  and category.archived_at is null;

update public.content_milestones as milestone
set category_id = category.id
from public.categories as category
where category.user_id = milestone.user_id
  and lower(category.name) = lower(case milestone.category when 'career' then 'Career' else 'Content' end)
  and category.archived_at is null;

alter table public.tasks add constraint tasks_category_owner_fk
  foreign key (user_id, category_id) references public.categories(user_id, id);
alter table public.task_recurrences add constraint task_recurrences_category_owner_fk
  foreign key (user_id, category_id) references public.categories(user_id, id);
alter table public.content_milestones add constraint content_milestones_category_owner_fk
  foreign key (user_id, category_id) references public.categories(user_id, id);

create index tasks_user_category_id_status_idx
  on public.tasks (user_id, category_id, status);
create index task_recurrences_user_category_id_idx
  on public.task_recurrences (user_id, category_id, active);
create index content_milestones_user_category_id_idx
  on public.content_milestones (user_id, category_id, achieved_at);

create or replace function public.assign_task_category(
  p_task_id uuid,
  p_expected_revision bigint,
  p_category_id uuid
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
  if not exists (
    select 1 from public.categories
    where id = p_category_id and user_id = user_id_value and archived_at is null
  ) then
    raise exception 'Choose an active category.' using errcode = '22023';
  end if;

  select * into task_value from public.tasks
  where id = p_task_id and user_id = user_id_value for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'That task no longer exists.');
  end if;
  if task_value.revision <> p_expected_revision then
    return jsonb_build_object('ok', false, 'code', 'stale', 'current_revision', task_value.revision, 'task', to_jsonb(task_value));
  end if;

  if task_value.recurrence_id is not null then
    update public.task_recurrences
      set category_id = p_category_id
      where id = task_value.recurrence_id and user_id = user_id_value;
    update public.tasks
      set category_id = p_category_id
      where recurrence_id = task_value.recurrence_id
        and user_id = user_id_value
        and status not in ('completed', 'skipped');
  else
    update public.tasks set category_id = p_category_id where id = p_task_id;
  end if;

  select * into task_value from public.tasks where id = p_task_id;
  return jsonb_build_object('ok', true, 'task', to_jsonb(task_value));
end;
$$;

create or replace function public.assign_recurrence_category(
  p_recurrence_id uuid,
  p_expected_revision bigint,
  p_category_id uuid
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
  if not exists (
    select 1 from public.categories
    where id = p_category_id and user_id = user_id_value and archived_at is null
  ) then
    raise exception 'Choose an active category.' using errcode = '22023';
  end if;

  select * into recurrence_value from public.task_recurrences
  where id = p_recurrence_id and user_id = user_id_value for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'That routine no longer exists.');
  end if;
  if recurrence_value.revision <> p_expected_revision then
    return jsonb_build_object('ok', false, 'code', 'stale', 'current_revision', recurrence_value.revision, 'recurrence', to_jsonb(recurrence_value));
  end if;

  update public.task_recurrences set category_id = p_category_id where id = p_recurrence_id;
  update public.tasks set category_id = p_category_id
    where recurrence_id = p_recurrence_id and user_id = user_id_value
      and status not in ('completed', 'skipped');
  select * into recurrence_value from public.task_recurrences where id = p_recurrence_id;
  return jsonb_build_object('ok', true, 'recurrence', to_jsonb(recurrence_value));
end;
$$;

revoke all on function public.assign_task_category(uuid, bigint, uuid) from public, anon;
revoke all on function public.assign_recurrence_category(uuid, bigint, uuid) from public, anon;
grant execute on function public.assign_task_category(uuid, bigint, uuid) to authenticated;
grant execute on function public.assign_recurrence_category(uuid, bigint, uuid) to authenticated;

create or replace function private.inherit_recurrence_category()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.category_id is null and new.recurrence_id is not null then
    select category_id into new.category_id
    from public.task_recurrences
    where id = new.recurrence_id and user_id = new.user_id;
  end if;
  return new;
end;
$$;

create trigger tasks_inherit_recurrence_category
  before insert on public.tasks for each row
  execute function private.inherit_recurrence_category();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'categories'
  ) then
    alter publication supabase_realtime add table public.categories;
  end if;
end
$$;
