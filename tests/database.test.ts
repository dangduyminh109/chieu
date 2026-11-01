import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
const ids = {
  admin: '00000000-0000-4000-8000-000000000001',
  owner: '00000000-0000-4000-8000-000000000002',
  worker: '00000000-0000-4000-8000-000000000003',
  other: '00000000-0000-4000-8000-000000000004',
};
let db: PGlite;
let mat: string;
let secondMat: string;
let stage: string;
let workId: string;
async function asUser<T = Record<string, unknown>>(
  id: string | null,
  sql: string,
  params: unknown[] = [],
) {
  await db.exec('begin');
  try {
    await db.exec(`set local role ${id ? 'authenticated' : 'anon'}`);
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [id ?? '']);
    const result = await db.query<T>(sql, params);
    await db.exec('commit');
    return result.rows;
  } catch (error) {
    await db.exec('rollback');
    throw error;
  }
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}'::jsonb); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`,
  );
  for (const migration of ['202611020001_foundation.sql', '202611020002_dashboard.sql'])
    await db.exec(await readFile(`supabase/migrations/${migration}`, 'utf8'));
  await db.exec(await readFile('supabase/seed.sql', 'utf8'));
  for (const [name, id] of Object.entries(ids))
    await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)', [
      id,
      `${name}@example.test`,
      JSON.stringify({ full_name: name, role: 'ADMIN' }),
    ]);
  await db.exec(
    `insert into public.user_roles values ('${ids.admin}','ADMIN'),('${ids.owner}','OWNER'),('${ids.owner}','WORKER'),('${ids.worker}','WORKER'),('${ids.other}','WORKER');`,
  );
  mat = (await db.query<{ id: string }>('select id from mat_types order by code limit 1')).rows[0]
    .id;
  secondMat = (
    await db.query<{ id: string }>('select id from mat_types order by code offset 1 limit 1')
  ).rows[0].id;
  stage = (await db.query<{ id: string }>("select id from production_stages where code='WEAVING'"))
    .rows[0].id;
  for (const id of [ids.worker, ids.owner, ids.other])
    await db.query('insert into worker_skills values($1,$2)', [id, stage]);
  for (const m of [mat, secondMat])
    await asUser(ids.owner, 'select add_labor_rate($1,$2,null,$3,8000)', [m, stage, '2026-01-01']);
});
afterAll(async () => {
  await db?.close();
});
describe('real PostgreSQL constraints, functions and RLS', () => {
  it('does not trust auth user metadata for role assignment', async () => {
    const rows = await asUser(ids.worker, 'select role from user_roles where user_id=auth.uid()');
    expect(rows).toEqual([{ role: 'WORKER' }]);
  });
  it('saves multiple mats on one date with snapshotted wages', async () => {
    for (const [i, m] of [mat, secondMat].entries()) {
      const rows = await asUser<{ submit_work: string }>(
        ids.worker,
        'select submit_work($1,$2,$3,10,$4,8000)',
        ['2026-11-01', stage, m, `10000000-0000-4000-8000-00000000000${i}`],
      );
      if (!i) workId = rows[0].submit_work;
    }
    const rows = await asUser(ids.worker, 'select total_amount from work_logs');
    expect(rows).toHaveLength(2);
    expect(Number(rows[0].total_amount)).toBe(80000);
  });
  it('deduplicates retries and rejects reused keys with different payloads', async () => {
    const params = ['2026-11-01', stage, mat, '10000000-0000-4000-8000-000000000000'];
    const rows = await asUser<{ submit_work: string }>(
      ids.worker,
      'select submit_work($1,$2,$3,10,$4,8000)',
      params,
    );
    expect(rows[0].submit_work).toBe(workId);
    await expect(
      asUser(ids.worker, 'select submit_work($1,$2,$3,11,$4,8000)', params),
    ).rejects.toThrow('IDEMPOTENCY_CONFLICT');
  });
  it('hides other workers and unauthenticated data', async () => {
    expect(await asUser(ids.other, 'select * from work_logs')).toHaveLength(0);
    await expect(asUser(null, 'select * from work_logs')).rejects.toThrow();
  });
  it('rejects direct table mutations and owner role escalation', async () => {
    await expect(asUser(ids.worker, 'update work_logs set quantity=100')).rejects.toThrow();
    await expect(
      asUser(ids.owner, "insert into user_roles values($1,'ADMIN')", [ids.owner]),
    ).rejects.toThrow();
    await expect(
      asUser(
        ids.owner,
        "select configure_member($1,array['ADMIN']::app_role[],array[]::uuid[],false,true,'Escalate')",
        [ids.worker],
      ),
    ).rejects.toThrow('FORBIDDEN');
  });
  it('denies invalid quantities and unassigned stages at database boundary', async () => {
    await expect(
      asUser(ids.worker, 'select submit_work($1,$2,$3,0,gen_random_uuid(),8000)', [
        '2026-11-01',
        stage,
        mat,
      ]),
    ).rejects.toThrow('INVALID_QUANTITY');
    const unassigned = (
      await db.query<{ id: string }>("select id from production_stages where code='SEWING'")
    ).rows[0].id;
    await expect(
      asUser(ids.worker, 'select submit_work($1,$2,$3,1,gen_random_uuid(),8000)', [
        '2026-11-01',
        unassigned,
        mat,
      ]),
    ).rejects.toThrow('SKILL_REQUIRED');
  });
  it('allows configured owner-worker zero wages', async () => {
    await db.query('update profiles set zero_wage=true where id=$1', [ids.owner]);
    await asUser(ids.owner, 'select submit_work($1,$2,$3,12,gen_random_uuid(),0)', [
      '2026-11-01',
      stage,
      mat,
    ]);
    const rows = await asUser(
      ids.owner,
      'select total_amount,zero_wage_applied from work_logs where worker_id=auth.uid()',
    );
    expect(Number(rows[0].total_amount)).toBe(0);
    expect(rows[0].zero_wage_applied).toBe(true);
  });
  it('keeps approved history unchanged after a new rate', async () => {
    await db.query("update work_logs set status='APPROVED' where id=$1", [workId]);
    await asUser(ids.owner, 'select add_labor_rate($1,$2,null,$3,12000)', [
      mat,
      stage,
      '2026-10-01',
    ]);
    const rows = await asUser(
      ids.worker,
      'select unit_rate,total_amount from work_logs where id=$1',
      [workId],
    );
    expect(Number(rows[0].unit_rate)).toBe(8000);
    expect(Number(rows[0].total_amount)).toBe(80000);
    await expect(
      asUser(ids.worker, 'delete from work_logs where id=$1', [workId]),
    ).rejects.toThrow();
  });
  it('rejects a stale rate preview instead of silently changing wages', async () => {
    await expect(
      asUser(ids.worker, 'select submit_work($1,$2,$3,1,gen_random_uuid(),8000)', [
        '2026-11-01',
        stage,
        mat,
      ]),
    ).rejects.toThrow('RATE_CHANGED');
  });
  it('makes audit admin-only and append-only for app users', async () => {
    expect((await asUser(ids.admin, 'select * from audit_logs')).length).toBeGreaterThan(0);
    expect(await asUser(ids.owner, 'select * from audit_logs')).toHaveLength(0);
    expect(await asUser(ids.worker, 'select * from audit_logs')).toHaveLength(0);
    await expect(asUser(ids.admin, 'delete from audit_logs')).rejects.toThrow();
  });
  it('prevents company-wide aggregation by workers and separates pending from approved', async () => {
    await expect(
      asUser(ids.worker, "select production_summary('2026-01-01','2026-12-31',false)"),
    ).rejects.toThrow('FORBIDDEN');
    const rows = await asUser<{
      production_summary: { approved_amount: number; submitted_amount: number };
    }>(ids.worker, "select production_summary('2026-01-01','2026-12-31',true)");
    expect(Number(rows[0].production_summary.approved_amount)).toBe(80000);
    expect(Number(rows[0].production_summary.submitted_amount)).toBe(80000);
  });
  it('revokes an inactive account even with a valid identity', async () => {
    await db.query('update profiles set active=false where id=$1', [ids.other]);
    expect(await asUser(ids.other, 'select * from mat_types')).toHaveLength(0);
    await expect(
      asUser(ids.other, 'select submit_work($1,$2,$3,1,gen_random_uuid(),8000)', [
        '2026-11-01',
        stage,
        mat,
      ]),
    ).rejects.toThrow('FORBIDDEN');
  });
});
