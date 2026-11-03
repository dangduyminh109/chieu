import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createTestDatabase, testIds } from './helpers/db';

describe('Backend: Commerce, Trading Documents & Cashflow', () => {
  let ctx: Awaited<ReturnType<typeof createTestDatabase>>;
  let conCoMat: string;
  let customerId: string;
  let supplierId: string;
  let repairCatId: string;

  beforeAll(async () => {
    ctx = await createTestDatabase();
    conCoMat = await ctx.getMatId('CHIEU_CON_CO');

    // Get REPAIR expense category
    const catRes = await ctx.db.query<{ id: string }>(
      "select id from expense_categories where code = 'REPAIR'",
    );
    repairCatId = catRes.rows[0].id;

    // Seed stock of 100 sewn mats for selling
    const seedItems = JSON.stringify([
      { mat_type_id: conCoMat, quantity: 100, unit_price: 0 },
    ]);
    await ctx.asUser(
      testIds.owner,
      `select post_document_stage(
        'FINISHED_RECEIPT',
        '2026-11-01'::date,
        $1::jsonb,
        gen_random_uuid(),
        'SEWN',
        null::uuid,
        null::uuid,
        null::text,
        null::uuid,
        0::bigint,
        0::bigint,
        'CASH',
        'TON-KHO-01',
        'Nhập tồn ban đầu'
      )`,
      [seedItems],
    );

    // Create a customer and a supplier
    const cRes = await ctx.asUser<{ save_contact: string }>(
      testIds.owner,
      'select save_contact($1::text, null::uuid, $2::text, $3::text, $4::text, true)',
      ['CUSTOMER', 'Đại lý chiếu Miền Tây', '0901234567', 'Khách sỉ'],
    );
    customerId = cRes[0].save_contact;

    const sRes = await ctx.asUser<{ save_contact: string }>(
      testIds.owner,
      'select save_contact($1::text, null::uuid, $2::text, $3::text, $4::text, true)',
      ['SUPPLIER', 'Vựa lát Cà Mau', '0912345678', 'Nhà cung cấp lát'],
    );
    supplierId = sRes[0].save_contact;
    expect(supplierId).toBeDefined();
  });

  afterAll(async () => {
    await ctx.db.close();
  });

  it('records a SALE document with partial payment and verifies stock and debt', async () => {
    const saleKey = '44444444-4444-4000-8000-000000000001';
    // Sell 20 mats @ 100,000 VND = 2,000,000 VND. Customer pays 1,200,000 VND cash. Unpaid = 800,000 VND
    const items = JSON.stringify([
      { mat_type_id: conCoMat, quantity: 20, unit_price: 100000 },
    ]);

    const res = await ctx.asUser<{ post_document: string }>(
      testIds.owner,
      `select post_document(
        'SALE',
        '2026-11-02'::date,
        $1::jsonb,
        $2::uuid,
        null::uuid,
        $3::uuid,
        'WHOLESALE',
        null::uuid,
        0::bigint,
        1200000::bigint,
        'CASH',
        null::text,
        'Bán chiếu con cờ cho đại lý'
      )`,
      [items, saleKey, customerId],
    );
    const docId = res[0].post_document;
    expect(docId).toBeDefined();

    // 1. Verify stock decreased by 20 (100 - 20 = 80)
    const stock = await ctx.asUser<{ sewn: number }>(
      testIds.owner,
      `select
        coalesce(sum(quantity) filter(where stage='SEWN'), 0) as sewn
       from public.mat_stage_movements
       where mat_type_id = $1`,
      [conCoMat],
    );
    expect(Number(stock[0].sewn)).toBe(80);

    // 2. Verify cashflow recorded 1,200,000 VND income (IN)
    const cash = await ctx.asUser<{
      cashflow_ledger: {
        income: string;
      };
    }>(
      testIds.owner,
      'select cashflow_ledger($1::date, $2::date, $3::text, null, 1)',
      ['2026-11-01', '2026-11-30', 'IN'],
    );
    expect(Number(cash[0].cashflow_ledger.income)).toBeGreaterThanOrEqual(1200000);

    // 3. Verify trading_history shows remaining receivable of 800,000 VND
    const history = await ctx.asUser<{
      trading_history: {
        receivable: string;
        rows: Array<{ id: string; remaining: string }>;
      };
    }>(
      testIds.owner,
      'select trading_history($1::date, $2::date, $3::text, true, $4::uuid, 1)',
      ['2026-11-01', '2026-11-30', 'SALE', customerId],
    );
    expect(Number(history[0].trading_history.receivable)).toBe(800000);
  });

  it('records debt payment via record_document_payment and clears debt', async () => {
    // Find the unpaid document
    const history = await ctx.asUser<{
      trading_history: {
        rows: Array<{ id: string; remaining: string }>;
      };
    }>(
      testIds.owner,
      'select trading_history($1::date, $2::date, $3::text, true, $4::uuid, 1)',
      ['2026-11-01', '2026-11-30', 'SALE', customerId],
    );
    const docId = history[0].trading_history.rows[0].id;

    // Customer pays the remaining 800,000 VND via BANK transfer
    const payKey = '44444444-4444-4000-8000-000000000002';
    await ctx.asUser(
      testIds.owner,
      'select record_document_payment($1::uuid, $2::date, 800000::bigint, $3::text, $4::text, $5::uuid)',
      [docId, '2026-11-03', 'BANK', 'Chuyển khoản thanh toán nốt', payKey],
    );

    // Verify debt is now 0
    const updated = await ctx.asUser<{
      trading_history: {
        receivable: string;
        rows: Array<{ id: string; remaining: string }>;
      };
    }>(
      testIds.owner,
      'select trading_history($1::date, $2::date, $3::text, true, $4::uuid, 1)',
      ['2026-11-01', '2026-11-30', 'SALE', customerId],
    );
    expect(Number(updated[0].trading_history.receivable)).toBe(0);
  });

  it('records an operational EXPENSE and updates cashflow', async () => {
    const expKey = '44444444-4444-4000-8000-000000000003';
    // Record machine maintenance expense: 350,000 VND
    await ctx.asUser(
      testIds.owner,
      `select post_document(
        'EXPENSE',
        '2026-11-02'::date,
        '[]'::jsonb,
        $1::uuid,
        null::uuid,
        null::uuid,
        null::text,
        $2::uuid,
        350000::bigint,
        350000::bigint,
        'CASH',
        null::text,
        'Thay phụ tùng máy dệt'
      )`,
      [expKey, repairCatId],
    );

    const cash = await ctx.asUser<{
      cashflow_ledger: {
        expense: string;
        rows: Array<{ amount: string; category: string }>;
      };
    }>(
      testIds.owner,
      'select cashflow_ledger($1::date, $2::date, $3::text, null, 1)',
      ['2026-11-01', '2026-11-30', 'OUT'],
    );
    const foundExp = cash[0].cashflow_ledger.rows.find((r) => r.category === 'Sửa máy');
    expect(foundExp).toBeDefined();
    expect(Number(foundExp!.amount)).toBe(350000);
  });

  it('denies workers from creating trading documents or viewing cashflow', async () => {
    await expect(
      ctx.asUser(
        testIds.worker,
        'select cashflow_ledger($1::date, $2::date, null, null, 1)',
        ['2026-11-01', '2026-11-30'],
      ),
    ).rejects.toThrow('FORBIDDEN');

    await expect(
      ctx.asUser(
        testIds.worker,
        `select post_document(
          'SALE',
          '2026-11-02'::date,
          '[]'::jsonb,
          '44444444-4444-4000-8000-000000000004'::uuid
        )`,
      ),
    ).rejects.toThrow('FORBIDDEN');
  });
});
