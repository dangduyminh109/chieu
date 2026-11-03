import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDatabase, testIds } from './helpers/db';

describe('Backend: Mat Stage Stock & Workflow Synchronization', () => {
  let ctx: Awaited<ReturnType<typeof createTestDatabase>>;
  let weaveStage: string;
  let tieStage: string;
  let cutStage: string;
  let sewStage: string;
  let conCoMat: string;

  beforeAll(async () => {
    ctx = await createTestDatabase();
    weaveStage = await ctx.getStageId('WEAVING');
    tieStage = await ctx.getStageId('TYING');
    cutStage = await ctx.getStageId('CUTTING');
    sewStage = await ctx.getStageId('SEWING');
    conCoMat = await ctx.getMatId('CHIEU_CON_CO');
  });

  afterAll(async () => {
    await ctx.db.close();
  });

  it('synchronizes stock through all 4 production stages', async () => {
    // 1. Dệt (WEAVING) 50 chiếc -> woven stock increases by 50
    await ctx.asUser(
      testIds.worker,
      'select submit_work_stock($1::date, $2::uuid, $3::uuid, 50, gen_random_uuid(), 10000, null)',
      ['2026-11-01', weaveStage, conCoMat],
    );

    let stock = await ctx.asUser<{
      woven: number;
      tied: number;
      cut: number;
      sewn: number;
      quantity: number;
    }>(
      testIds.owner,
      `select
        coalesce(sum(quantity), 0) as quantity,
        coalesce(sum(quantity) filter(where stage='WOVEN'), 0) as woven,
        coalesce(sum(quantity) filter(where stage='TIED'), 0) as tied,
        coalesce(sum(quantity) filter(where stage='CUT'), 0) as cut,
        coalesce(sum(quantity) filter(where stage='SEWN'), 0) as sewn
       from public.mat_stage_movements
       where mat_type_id = $1`,
      [conCoMat],
    );
    expect(Number(stock[0].woven)).toBe(50);
    expect(Number(stock[0].tied)).toBe(0);
    expect(Number(stock[0].cut)).toBe(0);
    expect(Number(stock[0].sewn)).toBe(0);
    expect(Number(stock[0].quantity)).toBe(50);

    // 2. Buộc (TYING) 30 chiếc -> moves from woven to tied
    await ctx.asUser(
      testIds.worker,
      'select submit_work_stock($1::date, $2::uuid, $3::uuid, 30, gen_random_uuid(), 500, null)',
      ['2026-11-01', tieStage, conCoMat],
    );

    stock = await ctx.asUser(
      testIds.owner,
      `select
        coalesce(sum(quantity), 0) as quantity,
        coalesce(sum(quantity) filter(where stage='WOVEN'), 0) as woven,
        coalesce(sum(quantity) filter(where stage='TIED'), 0) as tied,
        coalesce(sum(quantity) filter(where stage='CUT'), 0) as cut,
        coalesce(sum(quantity) filter(where stage='SEWN'), 0) as sewn
       from public.mat_stage_movements
       where mat_type_id = $1`,
      [conCoMat],
    );
    expect(Number(stock[0].woven)).toBe(20); // 50 - 30
    expect(Number(stock[0].tied)).toBe(30);
    expect(Number(stock[0].quantity)).toBe(50);

    // 3. Cắt (CUTTING) 25 chiếc -> moves from tied to cut
    await ctx.asUser(
      testIds.worker,
      'select submit_work_stock($1::date, $2::uuid, $3::uuid, 25, gen_random_uuid(), 1000, null)',
      ['2026-11-01', cutStage, conCoMat],
    );

    stock = await ctx.asUser(
      testIds.owner,
      `select
        coalesce(sum(quantity), 0) as quantity,
        coalesce(sum(quantity) filter(where stage='WOVEN'), 0) as woven,
        coalesce(sum(quantity) filter(where stage='TIED'), 0) as tied,
        coalesce(sum(quantity) filter(where stage='CUT'), 0) as cut,
        coalesce(sum(quantity) filter(where stage='SEWN'), 0) as sewn
       from public.mat_stage_movements
       where mat_type_id = $1`,
      [conCoMat],
    );
    expect(Number(stock[0].tied)).toBe(5); // 30 - 25
    expect(Number(stock[0].cut)).toBe(25);
    expect(Number(stock[0].quantity)).toBe(50);

    // 4. May (SEWING) 20 chiếc -> moves from cut to sewn
    await ctx.asUser(
      testIds.worker,
      'select submit_work_stock($1::date, $2::uuid, $3::uuid, 20, gen_random_uuid(), 1000, null)',
      ['2026-11-01', sewStage, conCoMat],
    );

    stock = await ctx.asUser(
      testIds.owner,
      `select
        coalesce(sum(quantity), 0) as quantity,
        coalesce(sum(quantity) filter(where stage='WOVEN'), 0) as woven,
        coalesce(sum(quantity) filter(where stage='TIED'), 0) as tied,
        coalesce(sum(quantity) filter(where stage='CUT'), 0) as cut,
        coalesce(sum(quantity) filter(where stage='SEWN'), 0) as sewn
       from public.mat_stage_movements
       where mat_type_id = $1`,
      [conCoMat],
    );
    expect(Number(stock[0].cut)).toBe(5); // 25 - 20
    expect(Number(stock[0].sewn)).toBe(20);
    expect(Number(stock[0].quantity)).toBe(50);
  });

  it('calculates production_stock_overview accurately', async () => {
    const overview = await ctx.asUser<{
      production_stock_overview: {
        date: string;
        mats: Array<{
          id: string;
          name: string;
          quantity: string;
          woven: string;
          tied: string;
          cut: string;
          sewn: string;
        }>;
      };
    }>(testIds.owner, 'select production_stock_overview($1::date)', ['2026-11-01']);

    const matData = overview[0].production_stock_overview.mats.find((m) => m.id === conCoMat);
    expect(matData).toBeDefined();
    expect(Number(matData!.quantity)).toBe(50);
    expect(Number(matData!.woven)).toBe(20);
    expect(Number(matData!.tied)).toBe(5);
    expect(Number(matData!.cut)).toBe(5);
    expect(Number(matData!.sewn)).toBe(20);

    // Ready to sell = cut (5) + sewn (20) = 25
    const readyToSell = Number(matData!.cut) + Number(matData!.sewn);
    expect(readyToSell).toBe(25);
  });

  it('supports manual stage advance via advance_mat_stage', async () => {
    // Advance remaining 5 CUT mats to SEWN
    await ctx.asUser(
      testIds.owner,
      'select advance_mat_stage($1::uuid, $2::text, 5, $3::date, gen_random_uuid())',
      [conCoMat, 'CUT', '2026-11-01'],
    );

    const stock = await ctx.asUser<{ cut: number; sewn: number; quantity: number }>(
      testIds.owner,
      `select
        coalesce(sum(quantity) filter(where stage='CUT'), 0) as cut,
        coalesce(sum(quantity) filter(where stage='SEWN'), 0) as sewn,
        coalesce(sum(quantity), 0) as quantity
       from public.mat_stage_movements
       where mat_type_id = $1`,
      [conCoMat],
    );
    expect(Number(stock[0].cut)).toBe(0); // 5 - 5
    expect(Number(stock[0].sewn)).toBe(25); // 20 + 5
    expect(Number(stock[0].quantity)).toBe(50);
  });

  it('supports direct finished stock receipt via post_document_stage', async () => {
    const key = '99999999-9999-4000-8000-000000000001';
    const items = JSON.stringify([
      { mat_type_id: conCoMat, quantity: 100, unit_price: 0 },
    ]);

    await ctx.asUser(
      testIds.owner,
      `select post_document_stage(
        'FINISHED_RECEIPT',
        $1::date,
        $2::jsonb,
        $3::uuid,
        'SEWN',
        null::uuid,
        null::uuid,
        null::text,
        null::uuid,
        0::bigint,
        0::bigint,
        'CASH',
        'NHAP-001',
        'Nhập kho thêm'
      )`,
      ['2026-11-01', items, key],
    );

    const stock = await ctx.asUser<{ sewn: number; quantity: number }>(
      testIds.owner,
      `select
        coalesce(sum(quantity) filter(where stage='SEWN'), 0) as sewn,
        coalesce(sum(quantity), 0) as quantity
       from public.mat_stage_movements
       where mat_type_id = $1`,
      [conCoMat],
    );
    expect(Number(stock[0].sewn)).toBe(125); // 25 + 100
    expect(Number(stock[0].quantity)).toBe(150); // 50 + 100
  });
});
