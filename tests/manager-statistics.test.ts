import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDatabase, testIds } from './helpers/db';

describe('Backend: Manager Statistics & Period Aggregations', () => {
  let ctx: Awaited<ReturnType<typeof createTestDatabase>>;
  let weaveStage: string;
  let tieStage: string;
  let whiteMat: string;

  beforeAll(async () => {
    ctx = await createTestDatabase();
    weaveStage = await ctx.getStageId('WEAVING');
    tieStage = await ctx.getStageId('TYING');
    whiteMat = await ctx.getMatId('CHIEU_TRANG');

    // Worker1 records work across 2 different days in November 2026
    await ctx.asUser(
      testIds.worker,
      'select submit_work_stock($1::date, $2::uuid, $3::uuid, 12, gen_random_uuid(), 8000, null)',
      ['2026-11-01', weaveStage, whiteMat],
    );
    await ctx.asUser(
      testIds.worker,
      'select submit_work_stock($1::date, $2::uuid, $3::uuid, 15, gen_random_uuid(), 8000, null)',
      ['2026-11-02', weaveStage, whiteMat],
    );

    // Worker2 records work on November 2026
    await ctx.asUser(
      testIds.worker2,
      'select submit_work_stock($1::date, $2::uuid, $3::uuid, 20, gen_random_uuid(), 500, null)',
      ['2026-11-02', tieStage, whiteMat],
    );
  });

  afterAll(async () => {
    await ctx.db.close();
  });

  it('aggregates monthly statistics accurately for all workers and stages', async () => {
    const res = await ctx.asUser<{
      manager_statistics: {
        records: number;
        work_days: number;
        points: Array<{ bucket: string; quantity: string; earned: string }>;
        comparison: Array<{ id: string; name: string; quantity: string; earned: string }>;
      };
    }>(
      testIds.owner,
      "select manager_statistics('2026-11-02'::date, 'month', null, null)",
    );

    const stats = res[0].manager_statistics;
    expect(stats.records).toBe(3);
    expect(stats.work_days).toBe(2);

    // Worker comparison
    const w1 = stats.comparison.find((c) => c.id === testIds.worker);
    const w2 = stats.comparison.find((c) => c.id === testIds.worker2);
    expect(w1).toBeDefined();
    expect(Number(w1!.quantity)).toBe(27); // 12 + 15
    expect(Number(w1!.earned)).toBe(216000); // 27 * 8000

    expect(w2).toBeDefined();
    expect(Number(w2!.quantity)).toBe(20);
    expect(Number(w2!.earned)).toBe(10000); // 20 * 500
  });

  it('filters statistics by specific worker', async () => {
    const res = await ctx.asUser<{
      manager_statistics: {
        records: number;
        comparison: Array<{ id: string }>;
      };
    }>(
      testIds.owner,
      "select manager_statistics('2026-11-02'::date, 'month', $1::uuid, null)",
      [testIds.worker2],
    );

    const stats = res[0].manager_statistics;
    expect(stats.records).toBe(1);
    expect(stats.comparison).toHaveLength(1);
    expect(stats.comparison[0].id).toBe(testIds.worker2);
  });

  it('filters statistics by specific production stage', async () => {
    const res = await ctx.asUser<{
      manager_statistics: {
        records: number;
      };
    }>(
      testIds.owner,
      "select manager_statistics('2026-11-02'::date, 'month', null, $1::uuid)",
      [tieStage],
    );

    const stats = res[0].manager_statistics;
    expect(stats.records).toBe(1); // Only worker2's TYING log
  });

  it('denies workers from calling manager_statistics', async () => {
    await expect(
      ctx.asUser(
        testIds.worker,
        "select manager_statistics('2026-11-02'::date, 'month', null, null)",
      ),
    ).rejects.toThrow('FORBIDDEN');
  });
});
