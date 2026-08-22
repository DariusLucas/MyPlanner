import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { getLocalSupabaseEnvironment } from "./supabase-env";

type Column = {
  column_default: string | null;
  column_name: string;
  data_type: string;
  is_identity: "NO" | "YES";
  is_nullable: "NO" | "YES";
  table_name: string;
  udt_name: string;
};

type Relationship = {
  columns: string[];
  constraint_name: string;
  foreign_columns: string[];
  foreign_table: string;
  table_name: string;
};

type Routine = {
  argument_list: string;
  default_count: number;
  function_name: string;
  result_type: string;
};

function postgresType(type: string, udtName?: string): string {
  const value = udtName || type;
  if (["bool", "boolean"].includes(value)) return "boolean";
  if (["int2", "int4", "int8", "float4", "float8", "numeric", "integer", "bigint", "smallint"].includes(value)) return "number";
  if (["json", "jsonb"].includes(value)) return "Json";
  if (value.startsWith("_") || type === "ARRAY") {
    return `${postgresType(value.replace(/^_/, ""))}[]`;
  }
  return "string";
}

function nullable(type: string, isNullable: boolean) {
  return isNullable ? `${type} | null` : type;
}

function property(name: string) {
  return /^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name);
}

function indent(lines: string[], spaces: number) {
  const prefix = " ".repeat(spaces);
  return lines.map((line) => `${prefix}${line}`);
}

function renderColumns(columns: Column[], mode: "insert" | "row" | "update") {
  return columns.map((column) => {
    const baseType = postgresType(column.data_type, column.udt_name);
    const type = nullable(baseType, column.is_nullable === "YES");
    const optional =
      mode === "update" ||
      (mode === "insert" &&
        (column.is_nullable === "YES" ||
          column.column_default !== null ||
          column.is_identity === "YES"));
    return `${property(column.column_name)}${optional ? "?" : ""}: ${type}`;
  });
}

function renderRoutine(routine: Routine) {
  const rawArguments = routine.argument_list.trim()
    ? routine.argument_list.split(/,\s*/)
    : [];
  const argumentsRendered = rawArguments.map((argument, index) => {
    const match = argument.match(/^([^ ]+)\s+(.+)$/);
    if (!match) throw new Error(`Unsupported function argument: ${argument}`);
    const [, name, type] = match;
    const optional = index >= rawArguments.length - routine.default_count;
    return `${property(name!)}${optional ? "?" : ""}: ${postgresType(type!)}`;
  });
  const args = argumentsRendered.length
    ? ["Args: {", ...indent(argumentsRendered, 2), "}"]
    : ["Args: Record<PropertyKey, never>"];
  return [
    `${property(routine.function_name)}: {`,
    ...indent(args, 2),
    `  Returns: ${postgresType(routine.result_type)}`,
    "}",
  ];
}

async function main() {
  const { databaseUrl } = getLocalSupabaseEnvironment();
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    const columns = (
      await client.query<Column>(`
        select table_name, column_name, data_type, udt_name, is_nullable,
               column_default, is_identity
        from information_schema.columns
        where table_schema = 'public'
          and table_name in (
            'app_settings', 'goals', 'sprints', 'sprint_weeks',
            'weekly_targets', 'daily_focus', 'task_recurrences', 'tasks',
            'content_milestones', 'quick_thoughts', 'task_events'
          )
        order by table_name, ordinal_position
      `)
    ).rows;

    const relationships = (
      await client.query<Relationship>(`
        select source.relname as table_name,
               constraint_row.conname as constraint_name,
               target.relname as foreign_table,
               to_json(array_agg(source_attribute.attname::text order by key_row.ordinality)) as columns,
               to_json(array_agg(target_attribute.attname::text order by key_row.ordinality)) as foreign_columns
        from pg_constraint as constraint_row
        join pg_class as source on source.oid = constraint_row.conrelid
        join pg_namespace as source_namespace on source_namespace.oid = source.relnamespace
        join pg_class as target on target.oid = constraint_row.confrelid
        join pg_namespace as target_namespace on target_namespace.oid = target.relnamespace
        join lateral unnest(constraint_row.conkey, constraint_row.confkey)
          with ordinality as key_row(source_number, target_number, ordinality) on true
        join pg_attribute as source_attribute
          on source_attribute.attrelid = source.oid and source_attribute.attnum = key_row.source_number
        join pg_attribute as target_attribute
          on target_attribute.attrelid = target.oid and target_attribute.attnum = key_row.target_number
        where constraint_row.contype = 'f'
          and source_namespace.nspname = 'public'
          and target_namespace.nspname = 'public'
        group by source.relname, constraint_row.conname, target.relname
        order by source.relname, constraint_row.conname
      `)
    ).rows;

    const routines = (
      await client.query<Routine>(`
        select procedure.proname as function_name,
               pg_get_function_identity_arguments(procedure.oid) as argument_list,
               procedure.pronargdefaults as default_count,
               pg_get_function_result(procedure.oid) as result_type
        from pg_proc as procedure
        join pg_namespace as namespace on namespace.oid = procedure.pronamespace
        where namespace.nspname = 'public'
          and procedure.prokind = 'f'
          and has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
        order by procedure.proname, procedure.oid
      `)
    ).rows;

    const tableNames = [...new Set(columns.map((column) => column.table_name))];
    const lines = [
      "// Generated from the applied Supabase development schema. Do not edit by hand.",
      "export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]",
      "",
      "export type Database = {",
      "  public: {",
      "    Tables: {",
    ];

    for (const tableName of tableNames) {
      const tableColumns = columns.filter((column) => column.table_name === tableName);
      const tableRelationships = relationships.filter((relationship) => relationship.table_name === tableName);
      lines.push(`      ${property(tableName)}: {`);
      lines.push("        Row: {");
      lines.push(...indent(renderColumns(tableColumns, "row"), 10));
      lines.push("        }");
      lines.push("        Insert: {");
      lines.push(...indent(renderColumns(tableColumns, "insert"), 10));
      lines.push("        }");
      lines.push("        Update: {");
      lines.push(...indent(renderColumns(tableColumns, "update"), 10));
      lines.push("        }");
      lines.push("        Relationships: [");
      for (const relationship of tableRelationships) {
        lines.push("          {");
        lines.push(`            foreignKeyName: ${JSON.stringify(relationship.constraint_name)}`);
        lines.push(`            columns: ${JSON.stringify(relationship.columns)}`);
        lines.push("            isOneToOne: false");
        lines.push(`            referencedRelation: ${JSON.stringify(relationship.foreign_table)}`);
        lines.push(`            referencedColumns: ${JSON.stringify(relationship.foreign_columns)}`);
        lines.push("          },");
      }
      lines.push("        ]");
      lines.push("      }");
    }

    lines.push("    }");
    lines.push("    Views: { [_ in never]: never }");
    lines.push("    Functions: {");
    for (const routine of routines) {
      lines.push(...indent(renderRoutine(routine), 6));
    }
    lines.push("    }");
    lines.push("    Enums: { [_ in never]: never }");
    lines.push("    CompositeTypes: { [_ in never]: never }");
    lines.push("  }");
    lines.push("}");
    lines.push("");

    const destination = path.join(
      process.cwd(),
      "src",
      "lib",
      "supabase",
      "database.types.ts",
    );
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, lines.join("\n"), "utf8");
    console.log("Generated Supabase database types from the remote schema.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
