import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { businessDate, displayDate } from '@/lib/utils';
import { dateSchema } from '@/features/production/schemas';
import { getInventory } from '@/features/commerce/data';
import { unitLabels, type Material } from '@/features/commerce/business-types';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { Field } from '@/components/ui/field';

export const metadata = { title: 'Lịch sử nguyên liệu' };
export default async function MaterialHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePermission('view_operations');
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const filters = await searchParams,
    today = businessDate();
  const from = dateSchema.safeParse(filters.from).success
    ? filters.from!
    : `${today.slice(0, 7)}-01`;
  const to = dateSchema.safeParse(filters.to).success ? filters.to! : today;
  const page = /^\d{1,5}$/.test(filters.page ?? '') ? Math.max(1, Number(filters.page)) : 1;
  const db = await createClient();
  const [material, inventory, movements] = await Promise.all([
    db.from('materials').select('*').eq('id', id).maybeSingle(),
    getInventory(),
    from <= to
      ? db
          .from('material_stock_movements')
          .select('id,business_date,quantity,weight_kg,item:document_items(document_id)', {
            count: 'exact',
          })
          .eq('material_id', id)
          .gte('business_date', from)
          .lte('business_date', to)
          .order('business_date', { ascending: false })
          .order('created_at', { ascending: false })
          .order('id')
          .range((page - 1) * 30, page * 30 - 1)
      : Promise.resolve({ data: null, count: 0, error: null }),
  ]);
  if (material.error || movements.error) throw new Error('Không tải được lịch sử nguyên liệu.');
  if (!material.data) notFound();
  const m = material.data as Material,
    s = inventory.materials.find((row) => row.id === id);
  const href = (next: number) => `?${new URLSearchParams({ from, to, page: String(next) })}`;
  return (
    <div className="space-y-5">
      <PageHeader
        title={m.name}
        action={
          <Link href="/materials" className="text-sm font-semibold text-primary">
            Về kho
          </Link>
        }
      />
      <Card className="!p-4">
        <p className="text-xs text-muted-foreground">Đang có trong kho</p>
        <strong className="mt-1 block text-xl text-primary">
          {Number(s?.quantity ?? 0).toLocaleString('vi-VN', { maximumFractionDigits: 3 })}{' '}
          {unitLabels[m.unit]}
        </strong>
        {m.is_sedge && (
          <p className="mt-1 text-sm">
            {Number(s?.weight_kg ?? 0).toLocaleString('vi-VN', { maximumFractionDigits: 3 })} kg
          </p>
        )}
      </Card>
      <Card className="!p-3">
        <form key={`${from}:${to}`} className="grid grid-cols-2 gap-3">
          <Field id="material-from" label="Từ ngày">
            <DatePicker id="material-from" name="from" defaultValue={from} max={today} />
          </Field>
          <Field id="material-to" label="Đến ngày">
            <DatePicker id="material-to" name="to" defaultValue={to} max={today} />
          </Field>
          <button type="submit" className="btn btn-outline col-span-2">
            Xem lịch sử
          </button>
        </form>
      </Card>
      {from > to ? (
        <p role="alert" className="text-destructive">
          Kiểm tra khoảng ngày.
        </p>
      ) : (
        <Card className="!p-4">
          <h2 className="font-bold">Nhập / xuất · {movements.count ?? 0} lần</h2>
          <div className="mt-2 divide-y divide-border">
            {movements.data?.map((row) => {
              const item = row.item as unknown as { document_id: string } | null;
              return (
                <div key={row.id} className="space-y-1 py-3">
                  <div className="flex flex-wrap justify-between gap-2 text-sm">
                    <strong>{Number(row.quantity) > 0 ? 'Nhập kho' : 'Xuất dùng'}</strong>
                    <strong className="text-primary">
                      {Number(row.quantity) > 0 ? '+' : ''}
                      {Number(row.quantity).toLocaleString('vi-VN', {
                        maximumFractionDigits: 3,
                      })}{' '}
                      {unitLabels[m.unit]}
                    </strong>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {displayDate(row.business_date)}
                    {row.weight_kg
                      ? ` · ${Number(row.weight_kg).toLocaleString('vi-VN', { maximumFractionDigits: 3 })} kg`
                      : ''}
                  </p>
                  {item && (
                    <Link
                      href={`/transactions/${item.document_id}`}
                      className="inline-block min-h-8 pt-1 text-xs font-semibold text-primary"
                    >
                      Xem phiếu
                    </Link>
                  )}
                </div>
              );
            })}
            {!movements.data?.length && (
              <p className="py-5 text-sm text-muted-foreground">
                Chưa có nhập/xuất trong khoảng này.
              </p>
            )}
          </div>
        </Card>
      )}
      <div className="flex items-center justify-between">
        {page > 1 ? (
          <Link className="btn btn-outline" href={href(page - 1)}>
            Trước
          </Link>
        ) : (
          <span />
        )}
        <span className="text-sm">Trang {page}</span>
        {page * 30 < (movements.count ?? 0) ? (
          <Link className="btn btn-outline" href={href(page + 1)}>
            Sau
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
