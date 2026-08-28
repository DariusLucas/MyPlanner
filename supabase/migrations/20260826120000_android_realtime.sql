do $$
declare
  planner_table text;
begin
  foreach planner_table in array array[
    'app_settings',
    'tasks',
    'task_recurrences',
    'daily_focus',
    'quick_thoughts',
    'content_milestones'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = planner_table
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        planner_table
      );
    end if;
  end loop;
end
$$;
