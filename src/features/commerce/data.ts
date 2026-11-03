import 'server-only';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { dateSchema } from '@/features/production/schemas';
const filterSchema = z
  .object({
    from: dateSchema,
    to: dateSchema,
    page: z.number().int().min(1).max(100000).default(1),
    pageSize: z.number().int().min(1).max(100).default(20),
    kind: z
      .enum([
        'MATERIAL_PURCHASE',
        'MATERIAL_ISSUE',
        'FINISHED_PURCHASE',
        'FINISHED_RECEIPT',
        'SALE',
        'EXPENSE',
      ])
      .optional(),
  })
  .refine((v) => v.from <= v.to);
export async function getDocuments(input: z.input<typeof filterSchema>) {
  await requirePermission('view_operations');
  const v = filterSchema.parse(input);
  const db = await createClient();
  let query = db
    .from('business_documents')
    .select(
      'id,kind,business_date,supplier_id,customer_id,sale_type,expense_category_id,total_amount,reference,notes,created_by,created_at',
      { count: 'exact' },
    )
    .gte('business_date', v.from)
    .lte('business_date', v.to)
    .order('business_date', { ascending: false })
    .order('id');
  if (v.kind) query = query.eq('kind', v.kind);
  const result = await query.range((v.page - 1) * v.pageSize, v.page * v.pageSize - 1);
  if (result.error) throw new Error('Không thể tải chứng từ.');
  return { rows: result.data, count: result.count ?? 0 };
}
export async function getDocument(id: string) {
  await requirePermission('view_operations');
  z.uuid().parse(id);
  const db = await createClient();
  const [header, items, payments, balance] = await Promise.all([
    db
      .from('business_documents')
      .select(
        'id,kind,business_date,supplier_id,customer_id,sale_type,expense_category_id,total_amount,reference,notes,created_by,created_at',
      )
      .eq('id', id)
      .single(),
    db
      .from('document_items')
      .select('*,material_bundles(*)')
      .eq('document_id', id)
      .order('line_number'),
    db.from('document_payments').select('*').eq('document_id', id).order('payment_date'),
    db.rpc('document_balance', { p_id: id }),
  ]);
  if (header.error || items.error || payments.error || balance.error)
    throw new Error('Không thể tải chi tiết chứng từ.');
  return {
    document: header.data,
    items: items.data,
    payments: payments.data,
    balance: balance.data,
  };
}
export async function getInventory() {
  await requirePermission('view_operations');
  const db = await createClient();
  const { data, error } = await db.rpc('inventory_summary');
  if (error) throw new Error('Không thể tải tồn kho.');
  return data as {
    materials: {
      id: string;
      name: string;
      unit: string;
      is_sedge: boolean;
      quantity: string;
      weight_kg: string;
    }[];
    finished: { id: string; name: string; quantity: string }[];
  };
}
export async function getFinancialSummary(from: string, to: string) {
  await requirePermission('view_financials');
  dateSchema.parse(from);
  dateSchema.parse(to);
  if (from > to) throw new Error('INVALID_DATE');
  const db = await createClient();
  const { data, error } = await db.rpc('financial_summary', { p_from: from, p_to: to });
  if (error) throw new Error('Không thể tải báo cáo thu chi.');
  return data as Record<string, string>;
}
export async function getMatPrice(
  matId: string,
  type: 'RETAIL' | 'WHOLESALE' | 'PURCHASE',
  date: string,
) {
  await requirePermission('view_operations');
  z.uuid().parse(matId);
  z.enum(['RETAIL', 'WHOLESALE', 'PURCHASE']).parse(type);
  dateSchema.parse(date);
  const db = await createClient();
  const result = await db
    .from('mat_price_history')
    .select('*')
    .eq('mat_type_id', matId)
    .eq('price_type', type)
    .lte('effective_from', date)
    .order('effective_from', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (result.error) throw new Error('Không thể tải giá chiếu.');
  return result.data;
}
