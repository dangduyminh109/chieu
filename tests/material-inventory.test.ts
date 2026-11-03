import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDatabase, testIds } from './helpers/db';

describe('Backend: Raw Material Inventory & Sedge Tracking', () => {
  let ctx: Awaited<ReturnType<typeof createTestDatabase>>;
  let supplierId: string;
  let threadMaterialId: string;
  let sedgeMaterialId: string;

  beforeAll(async () => {
    ctx = await createTestDatabase();

    // Create supplier
    const supRes = await ctx.asUser<{ save_contact: string }>(
      testIds.owner,
      'select save_contact($1::text, null::uuid, $2::text, $3::text, $4::text, true)',
      ['SUPPLIER', 'Vựa chỉ may An Giang', '0933221100', 'Cung cấp cuộn chỉ'],
    );
    supplierId = supRes[0].save_contact;

    // Create a non-sedge material (Thread/Chỉ)
    const threadRes = await ctx.asUser<{ save_material: string }>(
      testIds.owner,
      'select save_material(null::uuid, $1::text, $2::text, $3::text, false, true)',
      ['CHI_TRANG', 'Chỉ may màu trắng', 'PIECE'],
    );
    threadMaterialId = threadRes[0].save_material;

    // Create a sedge material (Lát)
    const sedgeRes = await ctx.asUser<{ save_material: string }>(
      testIds.owner,
      'select save_material(null::uuid, $1::text, $2::text, $3::text, true, true)',
      ['LAT_LOAI_1', 'Lát dệt loại 1', 'BUNDLE'],
    );
    sedgeMaterialId = sedgeRes[0].save_material;
  });

  afterAll(async () => {
    await ctx.db.close();
  });

  it('records MATERIAL_PURCHASE for non-sedge material and increments stock', async () => {
    const key = '55555555-5555-4000-8000-000000000001';
    // Buy 100 spools of thread @ 25,000 VND each = 2,500,000 VND
    const items = JSON.stringify([
      { material_id: threadMaterialId, quantity: 100, unit_price: 25000 },
    ]);

    await ctx.asUser(
      testIds.owner,
      `select post_document(
        'MATERIAL_PURCHASE',
        '2026-11-02'::date,
        $1::jsonb,
        $2::uuid,
        $3::uuid,
        null::uuid,
        null::text,
        null::uuid,
        0::bigint,
        2500000::bigint,
        'CASH',
        'HD-CHI-01',
        'Mua chỉ may đợt 1'
      )`,
      [items, key, supplierId],
    );

    // Verify material stock movements
    const stock = await ctx.asUser<{ quantity: number }>(
      testIds.owner,
      `select coalesce(sum(quantity), 0) as quantity
       from material_stock_movements
       where material_id = $1`,
      [threadMaterialId],
    );
    expect(Number(stock[0].quantity)).toBe(100);
  });

  it('records MATERIAL_ISSUE to issue thread into production and deducts stock', async () => {
    const key = '55555555-5555-4000-8000-000000000002';
    // Issue 30 spools of thread to production workshop (unit_price = 0)
    const items = JSON.stringify([
      { material_id: threadMaterialId, quantity: 30, unit_price: 0 },
    ]);

    await ctx.asUser(
      testIds.owner,
      `select post_document(
        'MATERIAL_ISSUE',
        '2026-11-02'::date,
        $1::jsonb,
        $2::uuid,
        null::uuid,
        null::uuid,
        null::text,
        null::uuid,
        0::bigint,
        0::bigint,
        'CASH',
        'XUAT-CHI-01',
        'Xuất chỉ cho tổ may'
      )`,
      [items, key],
    );

    const stock = await ctx.asUser<{ quantity: number }>(
      testIds.owner,
      `select coalesce(sum(quantity), 0) as quantity
       from material_stock_movements
       where material_id = $1`,
      [threadMaterialId],
    );
    expect(Number(stock[0].quantity)).toBe(70); // 100 - 30
  });

  it('rejects issuing more material than currently available (INSUFFICIENT_STOCK)', async () => {
    const key = '55555555-5555-4000-8000-000000000003';
    // Current stock is 70; attempting to issue 150 should throw INSUFFICIENT_STOCK
    const items = JSON.stringify([
      { material_id: threadMaterialId, quantity: 150, unit_price: 0 },
    ]);

    await expect(
      ctx.asUser(
        testIds.owner,
        `select post_document(
          'MATERIAL_ISSUE',
          '2026-11-02'::date,
          $1::jsonb,
          $2::uuid,
          null::uuid,
          null::uuid,
          null::text,
          null::uuid,
          0::bigint,
          0::bigint,
          'CASH',
          'XUAT-CHI-OVER',
          'Xuất quá số lượng tồn'
        )`,
        [items, key],
      ),
    ).rejects.toThrow('INSUFFICIENT_STOCK');
  });

  it('records MATERIAL_PURCHASE for sedge with bundles and bundle weights', async () => {
    const key = '55555555-5555-4000-8000-000000000004';
    // Sedge requires weight_kg and bundles array
    const bundles = [
      { weight_kg: 25.5, purchase_price: 150000, lon_count: 3 },
      { weight_kg: 24.5, purchase_price: 150000, lon_count: 3 },
    ];
    const items = JSON.stringify([
      {
        material_id: sedgeMaterialId,
        quantity: 2,
        unit_price: 150000,
        weight_kg: 50.0,
        bundles,
      },
    ]);

    await ctx.asUser(
      testIds.owner,
      `select post_document(
        'MATERIAL_PURCHASE',
        '2026-11-02'::date,
        $1::jsonb,
        $2::uuid,
        $3::uuid,
        null::uuid,
        null::text,
        null::uuid,
        0::bigint,
        300000::bigint,
        'CASH',
        'HD-LAT-01',
        'Mua 2 bó lát loại 1'
      )`,
      [items, key, supplierId],
    );

    // Verify sedge bundles stored
    const storedBundles = await ctx.asUser<{
      weight_kg: number;
      purchase_price: number;
    }>(
      testIds.owner,
      `select b.weight_kg, b.purchase_price
       from material_bundles b
       join document_items i on i.id = b.item_id
       where i.material_id = $1`,
      [sedgeMaterialId],
    );
    expect(storedBundles).toHaveLength(2);

    // Verify stock movements track both quantity and weight
    const stock = await ctx.asUser<{ quantity: number; weight_kg: number }>(
      testIds.owner,
      `select coalesce(sum(quantity), 0) as quantity, coalesce(sum(weight_kg), 0) as weight_kg
       from material_stock_movements
       where material_id = $1`,
      [sedgeMaterialId],
    );
    expect(Number(stock[0].quantity)).toBe(2);
    expect(Number(stock[0].weight_kg)).toBe(50.0);
  });
});
