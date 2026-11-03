'use server';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { chartRange } from './chart-period';
export async function getPersonalProductivityChart(input: {
  anchor: string;
  period: 'week' | 'month' | 'year';
  stageId?: string;
}) {
  const session = await requirePermission('submit_work');
  const v = z
    .object({
      anchor: z.iso.date().refine((d) => d >= '2000-01-01' && d <= '2100-12-31'),
      period: z.enum(['week', 'month', 'year']),
      stageId: z.uuid().optional(),
    })
    .parse(input);
  const range = chartRange(v.anchor, v.period);
  const db = await createClient();
  const rows: { work_date: string; quantity: number; total_amount: number }[] = [];
  for (let offset = 0; ; offset += 500) {
    let query = db
      .from('work_logs')
      .select('work_date,quantity,total_amount')
      .eq('worker_id', session.userId)
      .in('status', ['APPROVED', 'LOCKED', 'SUBMITTED'])
      .gte('work_date', range.start)
      .lte('work_date', range.end)
      .order('id')
      .range(offset, offset + 499);
    if (v.stageId) query = query.eq('stage_id', v.stageId);
    const result = await query;
    if (result.error) throw new Error('Không tải được biểu đồ.');
    rows.push(...result.data);
    if (result.data.length < 500) break;
  }
  const points = [];
  const day = new Date(`${range.start}T12:00:00Z`);
  const end = new Date(`${range.end}T12:00:00Z`);
  while (day <= end) {
    const key = day.toISOString().slice(0, v.period === 'year' ? 7 : 10);
    const matching = rows.filter((r) => r.work_date.startsWith(key));
    points.push({
      name:
        v.period === 'year'
          ? `T${day.getUTCMonth() + 1}`
          : v.period === 'week'
            ? ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][day.getUTCDay()]
            : String(day.getUTCDate()),
      quantity: matching.reduce((sum, r) => sum + r.quantity, 0),
      amount: matching.reduce((sum, r) => sum + Number(r.total_amount), 0),
      fullDate:
        v.period === 'year'
          ? `Tháng ${day.getUTCMonth() + 1}/${day.getUTCFullYear()}`
          : `Ngày ${day.getUTCDate()}/${day.getUTCMonth() + 1}/${day.getUTCFullYear()}`,
    });
    if (v.period === 'year') day.setUTCMonth(day.getUTCMonth() + 1);
    else day.setUTCDate(day.getUTCDate() + 1);
  }
  return { points, ...range };
}
