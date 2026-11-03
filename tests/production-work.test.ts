import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDatabase, testIds } from './helpers/db';

describe('Backend: Production Work Recording & Rates', () => {
  let ctx: Awaited<ReturnType<typeof createTestDatabase>>;
  let weaveStage: string;
  let whiteMat: string;

  beforeAll(async () => {
    ctx = await createTestDatabase();
    weaveStage = await ctx.getStageId('WEAVING');
    whiteMat = await ctx.getMatId('CHIEU_TRANG');
  });

  afterAll(async () => {
    await ctx.db.close();
  });

  it('records work with valid parameters and snapshots wage correctly', async () => {
    const key = '11111111-1111-4000-8000-000000000001';
    const rows = await ctx.asUser<{ submit_work_stock: string }>(
      testIds.worker,
      'select submit_work_stock($1::date, $2::uuid, $3::uuid, 10, $4::uuid, 8000, null)',
      ['2026-11-01', weaveStage, whiteMat, key],
    );
    expect(rows).toHaveLength(1);
    const workId = rows[0].submit_work_stock;
    expect(workId).toBeDefined();

    // Verify stored log
    const logs = await ctx.asUser<{
      id: string;
      quantity: number;
      unit_rate: number;
      total_amount: number;
      status: string;
    }>(
      testIds.worker,
      'select id, quantity, unit_rate, total_amount, status from work_logs where id = $1',
      [workId],
    );
    expect(logs).toHaveLength(1);
    expect(logs[0].quantity).toBe(10);
    expect(Number(logs[0].unit_rate)).toBe(8000);
    expect(Number(logs[0].total_amount)).toBe(80000);
    expect(logs[0].status).toBe('APPROVED');
  });

  it('guarantees idempotency: exact same retry returns same ID without duplicate row', async () => {
    const key = '11111111-1111-4000-8000-000000000002';
    const first = await ctx.asUser<{ submit_work_stock: string }>(
      testIds.worker,
      'select submit_work_stock($1::date, $2::uuid, $3::uuid, 5, $4::uuid, 8000, null)',
      ['2026-11-01', weaveStage, whiteMat, key],
    );
    const second = await ctx.asUser<{ submit_work_stock: string }>(
      testIds.worker,
      'select submit_work_stock($1::date, $2::uuid, $3::uuid, 5, $4::uuid, 8000, null)',
      ['2026-11-01', weaveStage, whiteMat, key],
    );
    expect(second[0].submit_work_stock).toBe(first[0].submit_work_stock);

    // Verify only 1 log created
    const count = await ctx.asUser<{ count: string }>(
      testIds.worker,
      'select count(*) as count from work_logs where idempotency_key = $1',
      [key],
    );
    expect(Number(count[0].count)).toBe(1);
  });

  it('rejects idempotency conflict when same key is sent with different quantity', async () => {
    const key = '11111111-1111-4000-8000-000000000003';
    await ctx.asUser(
      testIds.worker,
      'select submit_work_stock($1::date, $2::uuid, $3::uuid, 10, $4::uuid, 8000, null)',
      ['2026-11-01', weaveStage, whiteMat, key],
    );

    await expect(
      ctx.asUser(
        testIds.worker,
        'select submit_work_stock($1::date, $2::uuid, $3::uuid, 12, $4::uuid, 8000, null)',
        ['2026-11-01', weaveStage, whiteMat, key],
      ),
    ).rejects.toThrow('IDEMPOTENCY_CONFLICT');
  });

  it('rejects zero or negative quantities', async () => {
    await expect(
      ctx.asUser(
        testIds.worker,
        'select submit_work_stock($1::date, $2::uuid, $3::uuid, 0, gen_random_uuid(), 8000, null)',
        ['2026-11-01', weaveStage, whiteMat],
      ),
    ).rejects.toThrow('INVALID_QUANTITY');

    await expect(
      ctx.asUser(
        testIds.worker,
        'select submit_work_stock($1::date, $2::uuid, $3::uuid, -5, gen_random_uuid(), 8000, null)',
        ['2026-11-01', weaveStage, whiteMat],
      ),
    ).rejects.toThrow('INVALID_QUANTITY');
  });

  it('rejects future work dates', async () => {
    await expect(
      ctx.asUser(
        testIds.worker,
        'select submit_work_stock($1::date, $2::uuid, $3::uuid, 10, gen_random_uuid(), 8000, null)',
        ['2099-12-31', weaveStage, whiteMat],
      ),
    ).rejects.toThrow('INVALID_DATE');
  });

  it('attaches notes to work log properly', async () => {
    const key = '11111111-1111-4000-8000-000000000004';
    const noteText = 'Chiếu dệt buổi sáng, màu sắc đồng đều';
    const res = await ctx.asUser<{ submit_work_stock: string }>(
      testIds.worker,
      'select submit_work_stock($1::date, $2::uuid, $3::uuid, 8, $4::uuid, 8000, $5::text)',
      ['2026-11-01', weaveStage, whiteMat, key, noteText],
    );
    const log = await ctx.asUser<{ notes: string }>(
      testIds.worker,
      'select notes from work_logs where id = $1',
      [res[0].submit_work_stock],
    );
    expect(log[0].notes).toBe(noteText);
  });

  it('prioritizes worker-specific rate over general catalog rate', async () => {
    // Add special rate of 15,000 for worker2 on whiteMat + weaveStage
    await ctx.asUser(
      testIds.owner,
      'select add_labor_rate($1::uuid, $2::uuid, $3::uuid, $4::date, 15000::bigint)',
      [whiteMat, weaveStage, testIds.worker2, '2026-01-01'],
    );

    // worker2 records work using their custom rate 15,000
    const key = '11111111-1111-4000-8000-000000000005';
    const res = await ctx.asUser<{ submit_work_stock: string }>(
      testIds.worker2,
      'select submit_work_stock($1::date, $2::uuid, $3::uuid, 4, $4::uuid, 15000, null)',
      ['2026-11-01', weaveStage, whiteMat, key],
    );

    const log = await ctx.asUser<{ unit_rate: number; total_amount: number }>(
      testIds.worker2,
      'select unit_rate, total_amount from work_logs where id = $1',
      [res[0].submit_work_stock],
    );
    expect(Number(log[0].unit_rate)).toBe(15000);
    expect(Number(log[0].total_amount)).toBe(60000);
  });

  it('applies zero-wage policy for owner who records work for counting only', async () => {
    await ctx.db.query('update public.profiles set zero_wage = true where id = $1', [testIds.owner]);
    const key = '11111111-1111-4000-8000-000000000006';

    const res = await ctx.asUser<{ submit_work_stock: string }>(
      testIds.owner,
      'select submit_work_stock($1::date, $2::uuid, $3::uuid, 20, $4::uuid, 0, null)',
      ['2026-11-01', weaveStage, whiteMat, key],
    );

    const log = await ctx.asUser<{ total_amount: number; zero_wage_applied: boolean }>(
      testIds.owner,
      'select total_amount, zero_wage_applied from work_logs where id = $1',
      [res[0].submit_work_stock],
    );
    expect(Number(log[0].total_amount)).toBe(0);
    expect(log[0].zero_wage_applied).toBe(true);
  });

  it('enforces RLS: worker cannot see or query other workers work logs', async () => {
    const worker1Logs = await ctx.asUser(testIds.worker, 'select * from work_logs where worker_id = $1', [
      testIds.worker2,
    ]);
    expect(worker1Logs).toHaveLength(0);
  });
});
