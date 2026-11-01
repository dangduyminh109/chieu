import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { MatType, Stage, LaborRate, WorkLog } from '@/types/domain';
export async function getCatalog() {
  const db = await createClient();
  const [mats, stages] = await Promise.all([
    db.from('mat_types').select('*').order('code'),
    db.from('production_stages').select('*').order('sort_order'),
  ]);
  if (mats.error || stages.error) throw new Error('Không thể tải danh mục.');
  return { mats: mats.data as MatType[], stages: stages.data as Stage[] };
}
export async function getRates() {
  const db = await createClient();
  const rates: LaborRate[] = [];
  for (let offset = 0; ; offset += 500) {
    const result = await db
      .from('labor_rate_history')
      .select('*')
      .order('effective_from', { ascending: false })
      .order('id')
      .range(offset, offset + 499);
    if (result.error) throw new Error('Không thể tải đơn giá.');
    rates.push(...(result.data as LaborRate[]));
    if (result.data.length < 500) break;
  }
  return rates;
}
export async function getWorkLogs(
  userId: string | null,
  from: string,
  to: string,
  page = 1,
  pageSize = 20,
) {
  const db = await createClient();
  let query = db
    .from('work_logs')
    .select('*', { count: 'exact' })
    .gte('work_date', from)
    .lte('work_date', to)
    .order('work_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (userId) query = query.eq('worker_id', userId);
  const result = await query.range((page - 1) * pageSize, page * pageSize - 1);
  if (result.error) throw new Error('Không thể tải nhật ký sản xuất.');
  return { logs: result.data as WorkLog[], count: result.count ?? 0 };
}
