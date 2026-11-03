import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';

export const testIds = {
  admin: '00000000-0000-4000-8000-000000000001',
  owner: '00000000-0000-4000-8000-000000000002',
  worker: '00000000-0000-4000-8000-000000000003',
  worker2: '00000000-0000-4000-8000-000000000004',
  inactive: '00000000-0000-4000-8000-000000000005',
};

export async function createTestDatabase() {
  const db = new PGlite();

  // 1. Setup Auth and Storage mock foundations for Supabase
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create table auth.users (
      id uuid primary key,
      email text,
      raw_user_meta_data jsonb default '{}'::jsonb
    );
    create or replace function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;

    create schema storage;
    create table storage.buckets (
      id text primary key,
      name text,
      public boolean default false,
      file_size_limit bigint,
      allowed_mime_types text[]
    );
    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text references storage.buckets(id),
      name text,
      owner uuid
    );
    create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
      select string_to_array(name, '/');
    $$;
    grant usage on schema storage to anon, authenticated, service_role;
    grant all on all tables in schema storage to anon, authenticated, service_role;
    grant execute on function storage.foldername(text) to anon, authenticated, service_role;
  `);

  // 2. Run migrations in sorted order
  const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations');
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await db.exec(sql);

    // Ensure admin and initial catalog tables exist before subsequent migrations run
    if (file === '202611020002_dashboard.sql') {
      await db.query(
        'insert into auth.users(id, email, raw_user_meta_data) values ($1, $2, $3)',
        [testIds.admin, 'admin@example.test', JSON.stringify({ full_name: 'Quản trị viên' })],
      );
      await db.query(`insert into public.user_roles (user_id, role) values ('${testIds.admin}', 'ADMIN')`);

      await db.exec(`
        insert into public.production_stages(code,name,sort_order) values
          ('WEAVING','Dệt chiếu',1),('CUTTING','Cắt chiếu',2),('SEWING','May chiếu',3),('TYING','Buộc chiếu',4),('OTHER','Công việc khác',5)
        on conflict(code) do nothing;

        insert into public.expense_categories(code,name) values
          ('SEDGE','Mua lát'),('THREAD','Mua chỉ'),('FABRIC','Mua vải may chiếu'),('DYE','Mua màu nhuộm lát'),('REPAIR','Sửa máy'),('OTHER','Khác')
        on conflict(code) do nothing;

        insert into public.mat_types(code,name,description) values
          ('CHIEU_TRANG','Chiếu trắng',''),('CHIEU_CON_CO','Chiếu con cờ',''),('CHIEU_TRA_NIEN','Chiếu trà niên','')
        on conflict(code) do nothing;
      `);
    }
  }

  // Ensure default catalog labor rates and mat prices are effective from 2000-01-01 for all test dates
  await db.query("update public.labor_rate_history set effective_from = '2000-01-01'");

  // 3. Seed remaining test users
  const userSeeds = [
    { id: testIds.owner, email: 'owner@example.test', name: 'Chủ xưởng', roles: ['OWNER', 'WORKER'] },
    { id: testIds.worker, email: 'worker1@example.test', name: 'Thợ chính 1', roles: ['WORKER'] },
    { id: testIds.worker2, email: 'worker2@example.test', name: 'Thợ phụ 2', roles: ['WORKER'] },
    { id: testIds.inactive, email: 'inactive@example.test', name: 'Thợ nghỉ việc', roles: ['WORKER'] },
  ];

  for (const u of userSeeds) {
    await db.query(
      'insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3) on conflict (id) do nothing',
      [u.id, u.email, JSON.stringify({ full_name: u.name })],
    );

    for (const r of u.roles) {
      await db.query(
        'insert into public.user_roles (user_id, role) values ($1, $2) on conflict do nothing',
        [u.id, r],
      );
    }
  }

  // Assign all production skills to worker1 and owner
  const stagesRes = await db.query<{ id: string }>('select id from public.production_stages');
  for (const s of stagesRes.rows) {
    await db.query(
      'insert into public.worker_skills (user_id, stage_id) values ($1, $2), ($3, $2) on conflict do nothing',
      [testIds.worker, s.id, testIds.owner],
    );
  }

  // Deactivate inactive worker
  await db.query('update public.profiles set active = false where id = $1', [testIds.inactive]);

  // Helper to execute query as a specific user with RLS applied
  async function asUser<T = Record<string, unknown>>(
    userId: string | null,
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    await db.exec('begin');
    try {
      await db.exec(`set local role ${userId ? 'authenticated' : 'anon'}`);
      await db.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? '']);
      const result = await db.query<T>(sql, params);
      await db.exec('commit');
      return result.rows;
    } catch (error) {
      await db.exec('rollback');
      throw error;
    }
  }

  // Helper to get stage ID by code
  async function getStageId(code: string): Promise<string> {
    const res = await db.query<{ id: string }>(
      'select id from public.production_stages where code = $1',
      [code],
    );
    if (!res.rows[0]) throw new Error(`Stage not found: ${code}`);
    return res.rows[0].id;
  }

  // Helper to get mat ID by code
  async function getMatId(code: string): Promise<string> {
    const res = await db.query<{ id: string }>(
      'select id from public.mat_types where code = $1',
      [code],
    );
    if (!res.rows[0]) throw new Error(`Mat type not found: ${code}`);
    return res.rows[0].id;
  }

  return {
    db,
    testIds,
    asUser,
    getStageId,
    getMatId,
  };
}
