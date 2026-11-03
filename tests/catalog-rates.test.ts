import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDatabase, testIds } from './helpers/db';

describe('Backend: Catalog Products, Rates & Manager Overrides', () => {
  let ctx: Awaited<ReturnType<typeof createTestDatabase>>;
  let weaveStage: string;
  let customMatId: string;

  beforeAll(async () => {
    ctx = await createTestDatabase();
    weaveStage = await ctx.getStageId('WEAVING');
  });

  afterAll(async () => {
    await ctx.db.close();
  });

  it('allows manager to create a new mat product type via save_mat', async () => {
    const res = await ctx.asUser<{ save_mat: string }>(
      testIds.owner,
      'select save_mat(null::uuid, $1::text, $2::text, $3::text, $4::text, true)',
      ['CHIEU_VIP', 'Chiếu hoa cao cấp', '1.8m x 2m', 'Chiếu xuất khẩu'],
    );
    customMatId = res[0].save_mat;
    expect(customMatId).toBeDefined();

    // Verify row exists in mat_types
    const mats = await ctx.asUser<{ name: string; dimensions: string }>(
      testIds.owner,
      'select name, dimensions from mat_types where id = $1',
      [customMatId],
    );
    expect(mats[0].name).toBe('Chiếu hoa cao cấp');
    expect(mats[0].dimensions).toBe('1.8m x 2m');
  });

  it('allows manager to configure custom labor rate via add_labor_rate', async () => {
    const res = await ctx.asUser<{ add_labor_rate: string }>(
      testIds.owner,
      'select add_labor_rate($1::uuid, $2::uuid, null::uuid, $3::date, 16000::bigint)',
      [customMatId, weaveStage, '2026-01-01'],
    );
    expect(res[0].add_labor_rate).toBeDefined();

    // Verify rate stored
    const rates = await ctx.asUser<{ unit_rate: number }>(
      testIds.owner,
      'select unit_rate from labor_rate_history where id = $1',
      [res[0].add_labor_rate],
    );
    expect(Number(rates[0].unit_rate)).toBe(16000);
  });

  it('allows worker to record work with the new mat and new rate', async () => {
    const key = '77777777-7777-4000-8000-000000000001';
    const res = await ctx.asUser<{ submit_work_stock: string }>(
      testIds.worker,
      'select submit_work_stock($1::date, $2::uuid, $3::uuid, 5, $4::uuid, 16000::bigint, null)',
      ['2026-11-02', weaveStage, customMatId, key],
    );

    const logs = await ctx.asUser<{
      unit_rate: number;
      total_amount: number;
      version: number;
    }>(
      testIds.worker,
      'select unit_rate, total_amount, version from work_logs where id = $1',
      [res[0].submit_work_stock],
    );
    expect(Number(logs[0].unit_rate)).toBe(16000);
    expect(Number(logs[0].total_amount)).toBe(80000); // 5 * 16,000
  });

  it('allows manager to override work rate (override_work_rate) and recalculates total_amount', async () => {
    // Find worker1's log
    const logs = await ctx.asUser<{ id: string; version: number }>(
      testIds.owner,
      'select id, version from work_logs where worker_id = $1 limit 1',
      [testIds.worker],
    );
    const logId = logs[0].id;
    const currentVersion = logs[0].version;

    // Manager adjusts rate from 16,000 to 18,000 due to complex pattern
    await ctx.asUser(
      testIds.owner,
      'select override_work_rate($1::uuid, $2::integer, 18000::bigint, $3::text)',
      [logId, currentVersion, 'Thưởng thêm hoa văn phức tạp'],
    );

    const updated = await ctx.asUser<{
      unit_rate: number;
      total_amount: number;
      rate_override_reason: string;
      version: number;
    }>(
      testIds.owner,
      'select unit_rate, total_amount, rate_override_reason, version from work_logs where id = $1',
      [logId],
    );
    expect(Number(updated[0].unit_rate)).toBe(18000);
    expect(Number(updated[0].total_amount)).toBe(90000); // 5 * 18,000
    expect(updated[0].rate_override_reason).toBe('Thưởng thêm hoa văn phức tạp');
    expect(updated[0].version).toBe(currentVersion + 1);
  });

  it('rejects override_work_rate on version conflict', async () => {
    const logs = await ctx.asUser<{ id: string; version: number }>(
      testIds.owner,
      'select id, version from work_logs where worker_id = $1 limit 1',
      [testIds.worker],
    );
    const logId = logs[0].id;
    const outdatedVersion = logs[0].version - 1;

    await expect(
      ctx.asUser(
        testIds.owner,
        'select override_work_rate($1::uuid, $2::integer, 20000::bigint, $3::text)',
        [logId, outdatedVersion, 'Sửa với version cũ'],
      ),
    ).rejects.toThrow('VERSION_CONFLICT');
  });

  it('denies workers from calling override_work_rate', async () => {
    const logs = await ctx.asUser<{ id: string; version: number }>(
      testIds.worker,
      'select id, version from work_logs where worker_id = $1 limit 1',
      [testIds.worker],
    );

    await expect(
      ctx.asUser(
        testIds.worker,
        'select override_work_rate($1::uuid, $2::integer, 50000::bigint, $3::text)',
        [logs[0].id, logs[0].version, 'Thợ tự tăng lương'],
      ),
    ).rejects.toThrow('FORBIDDEN');
  });
});
