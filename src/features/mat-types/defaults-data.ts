import 'server-only';
import { getCatalog, getRates } from '@/features/shared/data';
import { createClient } from '@/lib/supabase/server';
import { businessDate } from '@/lib/utils';
import { selectLaborRate } from '@/features/production/calculations';
import type { MatDefaults } from './catalog-fields';
export async function getMatDefaults() {
  const [{ mats, stages }, rates] = await Promise.all([getCatalog(), getRates()]);
  const db = await createClient();
  const today = businessDate();
  const prices = await db
    .from('mat_price_history')
    .select('mat_type_id,unit_price')
    .eq('price_type', 'RETAIL')
    .lte('effective_from', today)
    .order('effective_from', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });
  if (prices.error) throw new Error('Không tải được giá bán.');
  const costs = await db
    .from('mat_cost_history')
    .select('mat_type_id,unit_cost')
    .lte('effective_from', today)
    .order('effective_from', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });
  if (costs.error) throw new Error('Không tải được giá vốn.');
  const defaults: Record<string, MatDefaults> = {};
  for (const mat of [...mats, { id: 'new' }]) {
    const rate = (code: string, fallback: number) => {
      const stage = stages.find((s) => s.code === code);
      return stage
        ? (selectLaborRate(
            rates.filter((r) => r.worker_id === null),
            code === 'WEAVING' ? mat.id : null,
            stage.id,
            '',
            today,
          )?.unit_rate ?? fallback)
        : fallback;
    };
    defaults[mat.id] = {
      cost_price: costs.data.find((p) => p.mat_type_id === mat.id)?.unit_cost ?? null,
      sale_price: Number(prices.data.find((p) => p.mat_type_id === mat.id)?.unit_price ?? 100000),
      weaving_rate: rate('WEAVING', 8000),
      sewing_rate: rate('SEWING', 1000),
      cutting_rate: rate('CUTTING', 1000),
      tying_rate: rate('TYING', 500),
    };
  }
  return defaults;
}
