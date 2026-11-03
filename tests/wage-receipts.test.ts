import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDatabase, testIds } from './helpers/db';

describe('Backend: Monthly Wage Receipt Confirmation & Lock Guarantees', () => {
  let ctx: Awaited<ReturnType<typeof createTestDatabase>>;
  let weaveStage: string;
  let whiteMat: string;
  let workLogId: string;

  beforeAll(async () => {
    ctx = await createTestDatabase();
    weaveStage = await ctx.getStageId('WEAVING');
    whiteMat = await ctx.getMatId('CHIEU_TRANG');

    // Worker records 10 white mats @ 8,000 VND = 80,000 VND
    const res = await ctx.asUser<{ submit_work_stock: string }>(
      testIds.worker,
      'select submit_work_stock($1::date, $2::uuid, $3::uuid, 10, gen_random_uuid(), 8000, null)',
      ['2026-11-01', weaveStage, whiteMat],
    );
    workLogId = res[0].submit_work_stock;
  });

  afterAll(async () => {
    await ctx.db.close();
  });

  it('rejects confirmation if expected amount does not match actual total earned', async () => {
    const key = '66666666-6666-4000-8000-000000000001';
    // Worker earned 80,000 VND but passes expected 100,000 VND -> WAGE_RECEIPT_CHANGED
    await expect(
      ctx.asUser(
        testIds.worker,
        'select confirm_monthly_wage_receipt($1::date, 100000::bigint, $2::uuid)',
        ['2026-11-01', key],
      ),
    ).rejects.toThrow('WAGE_RECEIPT_CHANGED');
  });

  it('allows worker to confirm their monthly wage receipt when expected matches', async () => {
    const key = '66666666-6666-4000-8000-000000000002';
    const res = await ctx.asUser<{ confirm_monthly_wage_receipt: string }>(
      testIds.worker,
      'select confirm_monthly_wage_receipt($1::date, 80000::bigint, $2::uuid)',
      ['2026-11-01', key],
    );
    const receiptId = res[0].confirm_monthly_wage_receipt;
    expect(receiptId).toBeDefined();

    // Verify receipt items created
    const items = await ctx.asUser<{ work_log_id: string; amount: number }>(
      testIds.worker,
      'select work_log_id, amount from wage_receipt_items where receipt_id = $1',
      [receiptId],
    );
    expect(items).toHaveLength(1);
    expect(items[0].work_log_id).toBe(workLogId);
    expect(Number(items[0].amount)).toBe(80000);
  });

  it('updates worker_monthly_wages to reflect received wage and zero remaining', async () => {
    const summary = await ctx.asUser<{
      worker_monthly_wages: Array<{
        month: string;
        earned: string;
        received: string;
        remaining: string;
      }>;
    }>(testIds.worker, 'select worker_monthly_wages(2026)');

    const nov = summary[0].worker_monthly_wages.find((m) => m.month === '2026-11');
    expect(nov).toBeDefined();
    expect(Number(nov!.earned)).toBe(80000);
    expect(Number(nov!.received)).toBe(80000);
    expect(Number(nov!.remaining)).toBe(0);
  });

  it('guarantees immutability: confirmed work log cannot be edited or modified', async () => {
    await expect(
      ctx.asUser(
        testIds.worker,
        'select edit_work_quantity($1::uuid, 1, 15, null, null, $2::date, null)',
        [workLogId, '2026-11-01'],
      ),
    ).rejects.toThrow('WORK_ALREADY_PAID_OR_LOCKED');
  });
});
