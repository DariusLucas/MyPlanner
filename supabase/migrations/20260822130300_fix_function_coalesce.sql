do $$
declare
  function_name text;
  function_definition text;
begin
  foreach function_name in array array['create_task', 'create_or_update_recurrence'] loop
    select pg_get_functiondef(procedure.oid) into function_definition
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public' and procedure.proname = function_name;

    function_definition := replace(
      function_definition,
      'pg_catalog.coalesce',
      'coalesce'
    );
    execute function_definition;
  end loop;
end;
$$;
