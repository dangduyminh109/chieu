import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDatabase, testIds } from './helpers/db';

describe('Backend: Users Management, RBAC & Audit Security', () => {
  let ctx: Awaited<ReturnType<typeof createTestDatabase>>;
  let weaveStage: string;

  beforeAll(async () => {
    ctx = await createTestDatabase();
    weaveStage = await ctx.getStageId('WEAVING');
  });

  afterAll(async () => {
    await ctx.db.close();
  });

  it('allows manager to update worker full_name, phone, and skills', async () => {
    await ctx.asUser(
      testIds.owner,
      `select update_member(
        $1::uuid,
        $2::text,
        $3::text,
        $4::text,
        array['WORKER']::app_role[],
        array[$5::uuid]::uuid[],
        true,
        false,
        'Cập nhật thông tin thợ'
      )`,
      [
        testIds.worker2,
        'Nguyễn Văn Thợ Hai',
        'tho_hai',
        '0988776655',
        weaveStage,
      ],
    );

    const profile = await ctx.asUser<{
      full_name: string;
      phone: string;
      username: string;
    }>(
      testIds.owner,
      'select full_name, phone, username from profiles where id = $1',
      [testIds.worker2],
    );
    expect(profile[0].full_name).toBe('Nguyễn Văn Thợ Hai');
    expect(profile[0].phone).toBe('0988776655');
    expect(profile[0].username).toBe('tho_hai');
  });

  it('rejects worker trying to escalate their own role to OWNER or ADMIN', async () => {
    await expect(
      ctx.asUser(
        testIds.worker,
        `select update_member(
          $1::uuid,
          $2::text,
          $3::text,
          null,
          array['ADMIN']::app_role[],
          array[]::uuid[],
          true,
          false,
          'Tự nâng cấp vai trò'
        )`,
        [testIds.worker, 'Tự nâng cấp', 'worker_self'],
      ),
    ).rejects.toThrow();

    await expect(
      ctx.asUser(
        testIds.worker,
        "insert into user_roles values ($1, 'ADMIN')",
        [testIds.worker],
      ),
    ).rejects.toThrow();
  });

  it('prevents owner from creating or granting ADMIN role', async () => {
    await expect(
      ctx.asUser(
        testIds.owner,
        `select update_member(
          $1::uuid,
          $2::text,
          $3::text,
          null,
          array['ADMIN']::app_role[],
          array[]::uuid[],
          true,
          false,
          'Owner phong Admin'
        )`,
        [testIds.worker2, 'Owner phong Admin', 'tho_hai'],
      ),
    ).rejects.toThrow();
  });

  it('revokes access when member is deactivated', async () => {
    // Deactivate worker2
    await ctx.asUser(
      testIds.owner,
      `select update_member(
        $1::uuid,
        $2::text,
        $3::text,
        null,
        array['WORKER']::app_role[],
        array[]::uuid[],
        false,
        false,
        'Vô hiệu hoá tài khoản'
      )`,
      [testIds.worker2, 'Nguyễn Văn Thợ Hai', 'tho_hai'],
    );

    // Deactivated worker query for mat_types returns 0 rows (RLS policy check)
    const mats = await ctx.asUser(testIds.worker2, 'select * from mat_types');
    expect(mats).toHaveLength(0);

    // Deactivated worker cannot submit work
    await expect(
      ctx.asUser(
        testIds.worker2,
        'select submit_work_stock($1::date, $2::uuid, null, 10, gen_random_uuid(), 8000, null)',
        ['2026-11-01', weaveStage],
      ),
    ).rejects.toThrow();
  });

  it('enforces append-only and admin-only access to audit logs', async () => {
    // Admin can view audit logs
    const adminLogs = await ctx.asUser(testIds.admin, 'select count(*) as count from audit_logs');
    expect(Number(adminLogs[0].count)).toBeGreaterThan(0);

    // Worker gets empty result or cannot read audit logs
    const workerLogs = await ctx.asUser(testIds.worker, 'select * from audit_logs');
    expect(workerLogs).toHaveLength(0);

    // Owner gets empty result
    const ownerLogs = await ctx.asUser(testIds.owner, 'select * from audit_logs');
    expect(ownerLogs).toHaveLength(0);

    // No one, even admin, can delete from audit_logs
    await expect(ctx.asUser(testIds.admin, 'delete from audit_logs')).rejects.toThrow();
  });
});
