'use server';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import type { Contact, Material } from './business-types';

export async function getBusinessOptions() {
  await requirePermission('view_operations');
  const db = await createClient();
  async function read(table: 'customers' | 'suppliers' | 'materials') {
    const rows: Record<string, unknown>[] = [];
    for (let page = 0; ; page++) {
      const result = await db
        .from(table)
        .select('*')
        .eq('active', true)
        .order('name')
        .order('id')
        .range(page * 500, (page + 1) * 500 - 1);
      if (result.error) throw new Error('Không tải được danh mục.');
      rows.push(...result.data);
      if (result.data.length < 500) return rows;
    }
  }
  const [customers, suppliers, materials] = await Promise.all([
    read('customers'),
    read('suppliers'),
    read('materials'),
  ]);
  return {
    customers: customers as unknown as Contact[],
    suppliers: suppliers as unknown as Contact[],
    materials: materials as unknown as Material[],
  };
}
