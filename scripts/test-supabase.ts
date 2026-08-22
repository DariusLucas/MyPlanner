import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client, type DatabaseError } from "pg";
import { getLocalSupabaseEnvironment } from "./supabase-env";

type RpcResult = {
  code?: string;
  created?: number;
  current_week_start?: string;
  idempotent?: boolean;
  ok: boolean;
  recurrence?: { id: string; revision: number };
  task?: { id: string; revision: number; status: string };
};

const userA = randomUUID();
const userB = randomUUID();
let savepointCounter = 0;
const expectedMigrationVersions = [
  "20260822105102",
  "20260822130000",
  "20260822130100",
  "20260822130200",
  "20260822130300",
];

async function setAuthenticatedUser(client: Client, userId: string) {
  await client.query("reset role");
  await client.query("set local role authenticated");
  await client.query(
    "select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)",
    [userId, JSON.stringify({ sub: userId, role: "authenticated" })],
  );
}

async function setAnonymous(client: Client) {
  await client.query("reset role");
  await client.query("set local role anon");
  await client.query(
    "select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', $1, true)",
    [JSON.stringify({ role: "anon" })],
  );
}

async function expectDatabaseError(
  client: Client,
  operation: () => Promise<unknown>,
  acceptedCodes: string[],
) {
  const savepoint = `expected_error_${savepointCounter++}`;
  await client.query(`savepoint ${savepoint}`);
  try {
    await operation();
    assert.fail("Expected the database operation to fail.");
  } catch (error) {
    const code = (error as DatabaseError).code;
    await client.query(`rollback to savepoint ${savepoint}`);
    assert.ok(code && acceptedCodes.includes(code), `Unexpected database error code: ${code}`);
  }
}

async function rpc(
  client: Client,
  sql: string,
  values: unknown[],
): Promise<RpcResult> {
  const result = await client.query<{ result: RpcResult }>(sql, values);
  return result.rows[0]!.result;
}

async function main() {
  const { databaseUrl, publishableKey, supabaseUrl } = getLocalSupabaseEnvironment();
  const settingsResponse = await fetch(`${supabaseUrl}/auth/v1/settings`, {
    headers: { apikey: publishableKey },
  });
  assert.equal(settingsResponse.ok, true, "Supabase Auth settings endpoint is available");
  const authSettings = (await settingsResponse.json()) as { external?: { email?: boolean } };
  assert.equal(authSettings.external?.email, true, "email authentication is enabled");

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  await client.query("begin");

  try {
    const migrationHistory = await client.query<{ version: string }>(
      `select version
       from supabase_migrations.schema_migrations
       where version = any($1::text[])
       order by version`,
      [expectedMigrationVersions],
    );
    assert.deepEqual(
      migrationHistory.rows.map((row) => row.version),
      expectedMigrationVersions,
      "all committed migrations are recorded remotely",
    );

    const schema = await client.query<{ count: string }>(`
      select count(*)::text as count
      from pg_class as table_row
      join pg_namespace as namespace on namespace.oid = table_row.relnamespace
      where namespace.nspname = 'public'
        and table_row.relkind = 'r'
        and table_row.relname in (
          'app_settings', 'goals', 'sprints', 'sprint_weeks',
          'weekly_targets', 'daily_focus', 'task_recurrences', 'tasks',
          'content_milestones', 'quick_thoughts', 'task_events'
        )
        and table_row.relrowsecurity
    `);
    assert.equal(Number(schema.rows[0]!.count), 11, "all planner tables have RLS enabled");

    const rpcSecurity = await client.query<{
      authenticated_can_execute: boolean;
      anon_can_execute: boolean;
      security_definer: boolean;
    }>(`
      select procedure.prosecdef as security_definer,
             has_function_privilege('authenticated', procedure.oid, 'EXECUTE') as authenticated_can_execute,
             has_function_privilege('anon', procedure.oid, 'EXECUTE') as anon_can_execute
      from pg_proc as procedure
      join pg_namespace as namespace on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'public'
        and procedure.proname in (
          'create_task', 'update_task', 'move_task_to_tomorrow',
          'reorder_task', 'set_task_workflow', 'complete_task',
          'reopen_task', 'delete_task', 'save_daily_focus',
          'create_or_update_recurrence', 'ensure_recurring_instances',
          'delete_or_deactivate_recurrence'
        )
    `);
    assert.equal(rpcSecurity.rowCount, 12, "all required planner RPCs exist");
    for (const functionRow of rpcSecurity.rows) {
      assert.equal(functionRow.security_definer, true, "planner RPC is security definer");
      assert.equal(functionRow.authenticated_can_execute, true, "authenticated can execute planner RPC");
      assert.equal(functionRow.anon_can_execute, false, "anon cannot execute planner RPC");
    }

    await client.query(
      `insert into auth.users (
        id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
      ) values
        ($1, 'authenticated', 'authenticated', $2, '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
        ($3, 'authenticated', 'authenticated', $4, '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now())`,
      [userA, `s2-a-${userA}@example.invalid`, userB, `s2-b-${userB}@example.invalid`],
    );

    await setAnonymous(client);
    await expectDatabaseError(
      client,
      () => client.query("select * from public.tasks"),
      ["42501"],
    );
    await expectDatabaseError(
      client,
      () => client.query("select public.create_task('{}'::jsonb, gen_random_uuid())"),
      ["42501"],
    );

    await setAuthenticatedUser(client, userA);
    await client.query(
      "insert into public.app_settings (user_id, timezone) values ($1, 'Europe/Bucharest')",
      [userA],
    );
    const goalId = randomUUID();
    await client.query(
      "insert into public.goals (id, user_id, title, category, start_date) values ($1, $2, 'S2 goal', 'career', current_date)",
      [goalId, userA],
    );

    const thoughtId = randomUUID();
    await client.query(
      "insert into public.quick_thoughts (id, user_id, text) values ($1, $2, 'RLS thought')",
      [thoughtId, userA],
    );
    const thoughtUpdate = await client.query<{ revision: string }>(
      "update public.quick_thoughts set text = 'Updated thought' where id = $1 and revision = 1 returning revision::text",
      [thoughtId],
    );
    assert.equal(Number(thoughtUpdate.rows[0]!.revision), 2, "direct optimistic update increments revision");

    const taskId = randomUUID();
    const created = await rpc(
      client,
      "select public.create_task($1::jsonb, $2::uuid) as result",
      [JSON.stringify({ title: "S2 task", category: "career", date: "2026-08-22", goal_id: goalId }), taskId],
    );
    assert.equal(created.ok, true);
    assert.equal(created.task?.revision, 1);
    const retriedCreate = await rpc(
      client,
      "select public.create_task($1::jsonb, $2::uuid) as result",
      [JSON.stringify({ title: "S2 task", category: "career", date: "2026-08-22", goal_id: goalId }), taskId],
    );
    assert.equal(retriedCreate.idempotent, true, "task creation retry is idempotent");

    const movableTaskId = randomUUID();
    const reorderableTaskId = randomUUID();
    await rpc(
      client,
      "select public.create_task($1::jsonb, $2::uuid) as result",
      [JSON.stringify({ title: "Move RPC task", category: "career", date: "2026-08-22" }), movableTaskId],
    );
    await rpc(
      client,
      "select public.create_task($1::jsonb, $2::uuid) as result",
      [JSON.stringify({ title: "Reorder RPC task", category: "career", date: "2026-08-22" }), reorderableTaskId],
    );
    const reordered = await rpc(
      client,
      "select public.reorder_task($1::uuid, 1, 'up') as result",
      [reorderableTaskId],
    );
    assert.equal(reordered.ok, true, "reorder task RPC succeeds");
    const moved = await rpc(
      client,
      "select public.move_task_to_tomorrow($1::uuid, 2) as result",
      [movableTaskId],
    );
    assert.equal(moved.task?.revision, 3, "move task RPC increments revision");
    const movedRow = await client.query<{ date: string }>(
      "select date::text from public.tasks where id = $1",
      [movableTaskId],
    );
    assert.equal(movedRow.rows[0]!.date, "2026-08-23", "move task RPC advances one local date");
    const deleted = await rpc(
      client,
      "select public.delete_task($1::uuid, 2) as result",
      [reorderableTaskId],
    );
    assert.equal(deleted.ok, true, "delete task RPC succeeds");
    const deletedRow = await client.query<{ count: string }>(
      "select count(*)::text as count from public.tasks where id = $1",
      [reorderableTaskId],
    );
    assert.equal(Number(deletedRow.rows[0]!.count), 0, "delete task RPC removes the task");
    const deleteRetry = await rpc(
      client,
      "select public.delete_task($1::uuid, 2) as result",
      [reorderableTaskId],
    );
    assert.equal(deleteRetry.idempotent, true, "delete task retry is idempotent");

    const updated = await rpc(
      client,
      "select public.update_task($1::uuid, $2::bigint, $3::jsonb) as result",
      [taskId, 1, JSON.stringify({ title: "Updated S2 task" })],
    );
    assert.equal(updated.task?.revision, 2);
    const stale = await rpc(
      client,
      "select public.update_task($1::uuid, $2::bigint, $3::jsonb) as result",
      [taskId, 1, JSON.stringify({ title: "Stale overwrite" })],
    );
    assert.equal(stale.code, "stale", "stale update is rejected");

    const workflow = await rpc(
      client,
      "select public.set_task_workflow($1::uuid, $2::bigint, 'done') as result",
      [taskId, 2],
    );
    assert.equal(workflow.task?.revision, 3);
    const completed = await rpc(
      client,
      "select public.complete_task($1::uuid, $2::bigint) as result",
      [taskId, 3],
    );
    assert.equal(completed.task?.status, "completed");
    const completionRetry = await rpc(
      client,
      "select public.complete_task($1::uuid, $2::bigint) as result",
      [taskId, 3],
    );
    assert.equal(completionRetry.idempotent, true);
    const completionEvents = await client.query<{ count: string }>(
      "select count(*)::text as count from public.task_events where task_id = $1 and kind = 'completed'",
      [taskId],
    );
    assert.equal(Number(completionEvents.rows[0]!.count), 1, "completion retry does not duplicate history");

    const reopened = await rpc(
      client,
      "select public.reopen_task($1::uuid, $2::bigint) as result",
      [taskId, completed.task!.revision],
    );
    assert.equal(reopened.task?.status, "not_started");

    const focusCreated = await rpc(
      client,
      "select public.save_daily_focus($1::date, $2::text, $3::text, null) as result",
      ["2026-08-22", "Ship S2", "Document S2"],
    );
    assert.equal(focusCreated.ok, true);
    const focusStale = await rpc(
      client,
      "select public.save_daily_focus($1::date, $2::text, $3::text, $4::bigint) as result",
      ["2026-08-22", "Overwrite", "Overwrite", 0],
    );
    assert.equal(focusStale.code, "stale");

    const currentWeekProbe = await rpc(
      client,
      "select public.ensure_recurring_instances('1900-01-01'::date) as result",
      [],
    );
    const currentWeek = currentWeekProbe.current_week_start!;
    const recurrenceId = randomUUID();
    const recurrence = await rpc(
      client,
      "select public.create_or_update_recurrence($1::jsonb, null, null, $2::uuid) as result",
      [JSON.stringify({ title: "S2 routine", category: "career", priority: "normal", count_per_week: 2, start_week: currentWeek }), recurrenceId],
    );
    assert.equal(recurrence.recurrence?.revision, 1);
    const ensured = await rpc(
      client,
      "select public.ensure_recurring_instances($1::date) as result",
      [currentWeek],
    );
    assert.equal(ensured.created, 2, "recurrence creates requested instances");
    const ensuredAgain = await rpc(
      client,
      "select public.ensure_recurring_instances($1::date) as result",
      [currentWeek],
    );
    assert.equal(ensuredAgain.created, 0, "recurrence retry creates no duplicates");

    const recurrenceTasks = await client.query<{ id: string; revision: string }>(
      "select id, revision::text from public.tasks where recurrence_id = $1 order by recurrence_index",
      [recurrenceId],
    );
    const firstRecurrenceTask = recurrenceTasks.rows[0]!;
    const recurrenceDone = await rpc(
      client,
      "select public.set_task_workflow($1::uuid, $2::bigint, 'done') as result",
      [firstRecurrenceTask.id, Number(firstRecurrenceTask.revision)],
    );
    await rpc(
      client,
      "select public.complete_task($1::uuid, $2::bigint) as result",
      [firstRecurrenceTask.id, recurrenceDone.task!.revision],
    );

    const recurrenceUpdated = await rpc(
      client,
      "select public.create_or_update_recurrence($1::jsonb, $2::uuid, $3::bigint, null) as result",
      [JSON.stringify({ title: "S2 routine", category: "career", priority: "normal", count_per_week: 1, start_week: currentWeek, active: true }), recurrenceId, 1],
    );
    await rpc(
      client,
      "select public.ensure_recurring_instances($1::date) as result",
      [currentWeek],
    );
    const deactivated = await rpc(
      client,
      "select public.delete_or_deactivate_recurrence($1::uuid, $2::bigint) as result",
      [recurrenceId, recurrenceUpdated.recurrence!.revision],
    );
    assert.equal(deactivated.ok, true);
    const preservedHistory = await client.query<{ count: string }>(
      "select count(*)::text as count from public.tasks where recurrence_id = $1 and status in ('completed', 'skipped')",
      [recurrenceId],
    );
    assert.equal(Number(preservedHistory.rows[0]!.count), 2, "recurrence history survives deactivation");

    await expectDatabaseError(
      client,
      () => client.query("update public.task_events set kind = 'restored' where task_id = $1", [taskId]),
      ["42501"],
    );
    await expectDatabaseError(
      client,
      () => client.query(
        "insert into public.tasks (user_id, title, category, date) values ($1, 'Bypass RPC', 'career', current_date)",
        [userA],
      ),
      ["42501"],
    );

    await setAuthenticatedUser(client, userB);
    const isolatedTasks = await client.query<{ count: string }>(
      "select count(*)::text as count from public.tasks",
    );
    assert.equal(Number(isolatedTasks.rows[0]!.count), 0, "User B cannot read User A tasks");
    const isolatedThoughts = await client.query<{ count: string }>(
      "select count(*)::text as count from public.quick_thoughts",
    );
    assert.equal(Number(isolatedThoughts.rows[0]!.count), 0, "User B cannot read User A thoughts");
    const hiddenUpdate = await rpc(
      client,
      "select public.update_task($1::uuid, 1, $2::jsonb) as result",
      [taskId, JSON.stringify({ title: "Cross-user update" })],
    );
    assert.equal(hiddenUpdate.code, "not_found", "cross-user RPC does not reveal task ownership");
    await expectDatabaseError(
      client,
      () => rpc(
        client,
        "select public.create_task($1::jsonb, $2::uuid) as result",
        [JSON.stringify({ title: "Forged parent", category: "career", date: "2026-08-22", goal_id: goalId }), randomUUID()],
      ),
      ["23503"],
    );

    await client.query("reset role");
    await client.query("rollback");
    console.log("Supabase migration history, schema, Auth availability, RLS isolation, revisions, RPCs, events, and recurrence checks passed.");
  } catch (error) {
    await client.query("reset role").catch(() => undefined);
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
