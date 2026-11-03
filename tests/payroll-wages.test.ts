import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDatabase, testIds } from './helpers/db';

describe('Backend: Payroll, Monthly Wages & Wage Receipts', () => {
  let ctx: Awaited<ReturnType<typeof createTestDatabase>>;
  let weaveStage: string;
  let traNienMat: string;

  beforeAll(async () => {
    ctx = await createTestDatabase();
    weaveStage = await ctx.getStageId('WEAVING');
    traNienMat = await ctx.getMatId('CHIEU_TRA_NIEN');

    // worker1 records work: 30 mats * 8000 = 240,000 VND in November 2026
    await ctx.asUser(
      testIds.worker,
      'select submit_work_stock($1::date, $2::uuid, $3::uuid, 30, gen_random_uuid(), 8000, null)',
      ['2026-11-02', weaveStage, traNienMat],
    );
  });

  afterAll(async () => {
    await ctx.db.close();
  });

  it('calculates manager_payroll totals correctly for the month', async () => {
    const payroll = await ctx.asUser<{
      manager_payroll: Array<{
        id: string;
        name: string;
        logs: Array<{ earned: string; paid: string; received: string }>;
        payments: Array<unknown>;
      }>;
    }>(testIds.owner, 'select manager_payroll($1::date)', ['2026-11-01']);

    const w1 = payroll[0].manager_payroll.find((w) => w.id === testIds.worker);
    expect(w1).toBeDefined();
    expect(w1!.logs).toHaveLength(1);
    expect(Number(w1!.logs[0].earned)).toBe(240000);
    expect(Number(w1!.logs[0].paid)).toBe(0);
    expect(Number(w1!.logs[0].received)).toBe(0);
  });

  it('denies workers from calling manager_payroll RPC', async () => {
    await expect(
      ctx.asUser(testIds.worker, 'select manager_payroll($1::date)', ['2026-11-01']),
    ).rejects.toThrow('FORBIDDEN');
  });

  it('pays monthly wages partially and tracks remaining debt', async () => {
    const payKey = '33333333-3333-4000-8000-000000000001';
    // Pay 100,000 VND out of 240,000 VND
    await ctx.asUser(
      testIds.owner,
      'select pay_monthly_wages($1::uuid, $2::date, 100000::bigint, $3::text, $4::text, $5::uuid)',
      [testIds.worker, '2026-11-01', 'CASH', 'Ứng trước tiền công', payKey],
    );

    // Verify payroll reflected the payment
    const payroll = await ctx.asUser<{
      manager_payroll: Array<{
        id: string;
        logs: Array<{ earned: string; paid: string }>;
        payments: Array<{ amount: string; method: string }>;
      }>;
    }>(testIds.owner, 'select manager_payroll($1::date)', ['2026-11-01']);

    const w1 = payroll[0].manager_payroll.find((w) => w.id === testIds.worker);
    expect(w1).toBeDefined();
    expect(w1!.payments).toHaveLength(1);
    expect(Number(w1!.payments[0].amount)).toBe(100000);
    expect(w1!.payments[0].method).toBe('CASH');

    // Also verify cashflow ledger recorded the outgoing expense (OUT)
    const cash = await ctx.asUser<{
      cashflow_ledger: {
        expense: string;
        rows: Array<{ amount: string; category: string; direction: string }>;
      };
    }>(
      testIds.owner,
      'select cashflow_ledger($1::date, $2::date, null, null, 1)',
      ['2026-11-01', '2026-11-30'],
    );
    expect(Number(cash[0].cashflow_ledger.expense)).toBeGreaterThanOrEqual(100000);
  });

  it('rejects overpaying wages beyond remaining amount', async () => {
    const payKey = '33333333-3333-4000-8000-000000000002';
    // Remaining is 140,000 VND (240k - 100k). Attempting to pay 200,000 VND should fail!
    await expect(
      ctx.asUser(
        testIds.owner,
        'select pay_monthly_wages($1::uuid, $2::date, 200000::bigint, $3::text, $4::text, $5::uuid)',
        [testIds.worker, '2026-11-01', 'CASH', 'Thanh toán vượt mức', payKey],
      ),
    ).rejects.toThrow('OVERPAYMENT');
  });

  it('allows worker to view their own monthly wages summary via worker_monthly_wages', async () => {
    const rows = await ctx.asUser<{
      worker_monthly_wages: Array<{
        month: string;
        earned: string;
        received: string;
        remaining: string;
      }>;
    }>(testIds.worker, 'select worker_monthly_wages(2026)');

    const nov = rows[0].worker_monthly_wages.find((m) => m.month === '2026-11');
    expect(nov).toBeDefined();
    expect(Number(nov!.earned)).toBe(240000);
  });
});
