import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDatabase, testIds } from './helpers/db';

describe('Backend: Work Log Editing (edit_work_quantity)', () => {
  let ctx: Awaited<ReturnType<typeof createTestDatabase>>;
  let weaveStage: string;
  let whiteMat: string;
  let editableLogId: string;

  beforeAll(async () => {
    ctx = await createTestDatabase();
    weaveStage = await ctx.getStageId('WEAVING');
    whiteMat = await ctx.getMatId('CHIEU_TRANG');

    // Create an initial work log for worker1
    const res = await ctx.asUser<{ submit_work_stock: string }>(
      testIds.worker,
      'select submit_work_stock($1::date, $2::uuid, $3::uuid, 10, gen_random_uuid(), 8000, null)',
      ['2026-11-01', weaveStage, whiteMat],
    );
    editableLogId = res[0].submit_work_stock;
  });

  afterAll(async () => {
    await ctx.db.close();
  });

  it('allows worker to edit their own unpaid work log quantity and recalculates total', async () => {
    const logsBefore = await ctx.asUser<{ version: number }>(
      testIds.worker,
      'select version from work_logs where id = $1',
      [editableLogId],
    );
    const version = logsBefore[0].version;

    await ctx.asUser(
      testIds.worker,
      'select edit_work_quantity($1::uuid, $2::integer, 15, null, null, $3::date, $4::text)',
      [editableLogId, version, '2026-11-01', 'Đã đếm lại, đúng 15 chiếc'],
    );

    const log = await ctx.asUser<{
      quantity: number;
      total_amount: number;
      notes: string;
    }>(
      testIds.worker,
      'select quantity, total_amount, notes from work_logs where id = $1',
      [editableLogId],
    );
    expect(log[0].quantity).toBe(15);
    expect(Number(log[0].total_amount)).toBe(120000); // 15 * 8000
    expect(log[0].notes).toBe('Đã đếm lại, đúng 15 chiếc');
  });

  it('rejects editing work log of another worker', async () => {
    await expect(
      ctx.asUser(
        testIds.worker2,
        'select edit_work_quantity($1::uuid, 1, 20, null, null, $2::date, $3::text)',
        [editableLogId, '2026-11-01', 'Thợ khác cố tình sửa'],
      ),
    ).rejects.toThrow('NOT_FOUND');
  });

  it('rejects invalid quantity (<= 0) during edit', async () => {
    const logs = await ctx.asUser<{ version: number }>(
      testIds.worker,
      'select version from work_logs where id = $1',
      [editableLogId],
    );
    const version = logs[0].version;

    await expect(
      ctx.asUser(
        testIds.worker,
        'select edit_work_quantity($1::uuid, $2::integer, 0, null, null, $3::date, $4::text)',
        [editableLogId, version, '2026-11-01', 'Số lượng 0'],
      ),
    ).rejects.toThrow('INVALID_QUANTITY');
  });

  it('rejects future work date during edit', async () => {
    const logs = await ctx.asUser<{ version: number }>(
      testIds.worker,
      'select version from work_logs where id = $1',
      [editableLogId],
    );
    const version = logs[0].version;

    await expect(
      ctx.asUser(
        testIds.worker,
        'select edit_work_quantity($1::uuid, $2::integer, 10, null, null, $3::date, $4::text)',
        [editableLogId, version, '2099-12-31', 'Ngày tương lai'],
      ),
    ).rejects.toThrow('INVALID_DATE');
  });

  it('rejects editing paid or locked work logs', async () => {
    // Create a new work log specifically for locking test
    const res = await ctx.asUser<{ submit_work_stock: string }>(
      testIds.worker,
      'select submit_work_stock($1::date, $2::uuid, $3::uuid, 5, gen_random_uuid(), 8000, null)',
      ['2026-11-01', weaveStage, whiteMat],
    );
    const lockLogId = res[0].submit_work_stock;

    const logs = await ctx.asUser<{ version: number }>(
      testIds.worker,
      'select version from work_logs where id = $1',
      [lockLogId],
    );
    const version = logs[0].version;

    // Lock the log
    await ctx.db.query("update work_logs set status = 'LOCKED' where id = $1", [lockLogId]);

    await expect(
      ctx.asUser(
        testIds.worker,
        'select edit_work_quantity($1::uuid, $2::integer, 25, null, null, $3::date, $4::text)',
        [lockLogId, version, '2026-11-01', 'Sửa log đã khóa'],
      ),
    ).rejects.toThrow('WORK_ALREADY_PAID_OR_LOCKED');
  });
});
