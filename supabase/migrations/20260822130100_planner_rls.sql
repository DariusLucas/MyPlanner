do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'app_settings', 'goals', 'sprints', 'sprint_weeks', 'weekly_targets',
    'daily_focus', 'task_recurrences', 'tasks', 'content_milestones',
    'quick_thoughts', 'task_events'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
  end loop;
end;
$$;

grant select on table
  public.app_settings,
  public.goals,
  public.sprints,
  public.sprint_weeks,
  public.weekly_targets,
  public.daily_focus,
  public.task_recurrences,
  public.tasks,
  public.content_milestones,
  public.quick_thoughts,
  public.task_events
to authenticated;

grant insert, update on table public.app_settings to authenticated;
grant insert, update, delete on table
  public.goals,
  public.sprints,
  public.sprint_weeks,
  public.weekly_targets,
  public.content_milestones,
  public.quick_thoughts
to authenticated;

create policy app_settings_select_own on public.app_settings
  for select to authenticated using ((select auth.uid()) = user_id);
create policy app_settings_insert_own on public.app_settings
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy app_settings_update_own on public.app_settings
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy goals_select_own on public.goals
  for select to authenticated using ((select auth.uid()) = user_id);
create policy goals_insert_own on public.goals
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy goals_update_own on public.goals
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy goals_delete_own on public.goals
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy sprints_select_own on public.sprints
  for select to authenticated using ((select auth.uid()) = user_id);
create policy sprints_insert_own on public.sprints
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy sprints_update_own on public.sprints
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy sprints_delete_own on public.sprints
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy sprint_weeks_select_own on public.sprint_weeks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy sprint_weeks_insert_own on public.sprint_weeks
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy sprint_weeks_update_own on public.sprint_weeks
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy sprint_weeks_delete_own on public.sprint_weeks
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy weekly_targets_select_own on public.weekly_targets
  for select to authenticated using ((select auth.uid()) = user_id);
create policy weekly_targets_insert_own on public.weekly_targets
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy weekly_targets_update_own on public.weekly_targets
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy weekly_targets_delete_own on public.weekly_targets
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy daily_focus_select_own on public.daily_focus
  for select to authenticated using ((select auth.uid()) = user_id);

create policy task_recurrences_select_own on public.task_recurrences
  for select to authenticated using ((select auth.uid()) = user_id);

create policy tasks_select_own on public.tasks
  for select to authenticated using ((select auth.uid()) = user_id);

create policy content_milestones_select_own on public.content_milestones
  for select to authenticated using ((select auth.uid()) = user_id);
create policy content_milestones_insert_own on public.content_milestones
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy content_milestones_update_own on public.content_milestones
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy content_milestones_delete_own on public.content_milestones
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy quick_thoughts_select_own on public.quick_thoughts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy quick_thoughts_insert_own on public.quick_thoughts
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy quick_thoughts_update_own on public.quick_thoughts
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy quick_thoughts_delete_own on public.quick_thoughts
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy task_events_select_own on public.task_events
  for select to authenticated using ((select auth.uid()) = user_id);
