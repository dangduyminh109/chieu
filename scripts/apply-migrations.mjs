import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Explicit migration filenames only. Credentials stay in the child environment.
if (fs.existsSync('.env.local')) process.loadEnvFile('.env.local');
if (!process.env.SUPABASE_DB_URL) throw new Error('SUPABASE_DB_URL is required.');
const files = process.argv.slice(2);
if (!files.length || files.some((name) => !/^\d{12}_[a-z_]+\.sql$/.test(name))) {
  throw new Error('Pass explicit migration filenames from supabase/migrations.');
}
const url = new URL(process.env.SUPABASE_DB_URL);
const env = {
  ...process.env,
  PGHOST: url.hostname,
  PGPORT: url.port || '5432',
  PGUSER: decodeURIComponent(url.username),
  PGPASSWORD: decodeURIComponent(url.password),
  PGDATABASE: url.pathname.slice(1) || 'postgres',
  PGSSLMODE: 'require',
  PGCONNECT_TIMEOUT: '15',
};
const windowsPsql = 'C:/Program Files/PostgreSQL/18/bin/psql.exe';
const bin = process.env.PSQL_PATH || (fs.existsSync(windowsPsql) ? windowsPsql : 'psql');
function execute(sql, tuples = false) {
  const args = ['-X', '-v', 'ON_ERROR_STOP=1', ...(tuples ? ['-tA'] : [])];
  const result = spawnSync(bin, args, { input: sql, env, encoding: 'utf8' });
  if (result.error || result.status !== 0)
    throw new Error(result.stderr || 'Database migration could not execute.');
  return result.stdout.trim();
}
execute(
  'create table if not exists public.app_migrations(version text primary key, applied_at timestamptz not null default now()); alter table public.app_migrations enable row level security; revoke all on public.app_migrations from anon,authenticated;',
);
for (const name of files.sort()) {
  const version = name.slice(0, 12);
  if (
    execute(
      `select exists(select 1 from public.app_migrations where version='${version}');`,
      true,
    ) === 't'
  ) {
    console.log(`${name}: already applied`);
    continue;
  }
  const sql = fs.readFileSync(path.join('supabase/migrations', name), 'utf8');
  if (!/commit;\s*$/i.test(sql)) throw new Error('Migration must end with commit.');
  execute(
    sql.replace(
      /commit;\s*$/i,
      `insert into public.app_migrations(version) values('${version}');\ncommit;`,
    ),
  );
  console.log(`${name}: applied`);
}
