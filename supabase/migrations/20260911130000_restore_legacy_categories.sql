-- Preserve the three legacy spaces for users who already had planner data
-- before categories became user-defined. New users are intentionally not
-- seeded, and users with no planner data are left untouched.
with existing_planner_users as (
  select user_id from public.app_settings
  union
  select user_id from public.tasks
  union
  select user_id from public.task_recurrences
  union
  select user_id from public.content_milestones
)
insert into public.categories (user_id, name, icon, position)
select users.id, legacy.name, legacy.icon, legacy.position
from auth.users as users
join existing_planner_users as planner_user on planner_user.user_id = users.id
cross join (values
  ('Career'::text, 'briefcase'::text, 0),
  ('Content'::text, 'clapperboard'::text, 1),
  ('Personal'::text, 'coffee'::text, 2)
) as legacy(name, icon, position)
where not exists (
  select 1
  from public.categories as existing
  where existing.user_id = users.id
    and lower(pg_catalog.btrim(existing.name)) = lower(legacy.name)
    and existing.archived_at is null
);
