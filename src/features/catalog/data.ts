import 'server-only';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
const tables = {
  customers: 'customers',
  suppliers: 'suppliers',
  materials: 'materials',
  expense_categories: 'expense_categories',
} as const;
export async function getBusinessCatalog(kind: keyof typeof tables, page = 1, pageSize = 50) {
  await requirePermission('view_operations');
  z.enum(['customers', 'suppliers', 'materials', 'expense_categories']).parse(kind);
  z.number().int().min(1).max(100000).parse(page);
  z.number().int().min(1).max(100).parse(pageSize);
  const db = await createClient();
  const result = await db
    .from(tables[kind])
    .select('*', { count: 'exact' })
    .order('name')
    .order('id')
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (result.error) throw new Error('Không thể tải danh mục.');
  return { rows: result.data, count: result.count ?? 0 };
}
