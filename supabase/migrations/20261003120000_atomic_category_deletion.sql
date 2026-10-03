create or replace function public.delete_planner_category(
  p_category_id uuid,
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
  category_value public.categories%rowtype;
begin
  select * into category_value
  from public.categories
  where id = p_category_id and user_id = user_id_value
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'That category no longer exists.');
  end if;

  if category_value.revision <> p_expected_revision then
    return jsonb_build_object('ok', false, 'code', 'stale', 'message', 'This category changed in another session. Refresh and try again.');
  end if;

  if exists (select 1 from public.tasks where user_id = user_id_value and category_id = p_category_id)
    or exists (select 1 from public.task_recurrences where user_id = user_id_value and category_id = p_category_id)
    or exists (select 1 from public.content_milestones where user_id = user_id_value and category_id = p_category_id)
  then
    return jsonb_build_object('ok', false, 'code', 'history', 'message', 'This category contains planner history, so it can only be archived.');
  end if;

  delete from public.categories
  where id = p_category_id and user_id = user_id_value;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.delete_planner_category(uuid, bigint) from public, anon;
grant execute on function public.delete_planner_category(uuid, bigint) to authenticated;
