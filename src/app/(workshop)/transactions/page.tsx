import Link from 'next/link';
import { ShoppingBag, Filter } from 'lucide-react';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { businessDate, displayDate } from '@/lib/utils';
import { dateSchema } from '@/features/production/schemas';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ManagementMetrics } from '@/components/ui/management';
import { DatePicker } from '@/components/ui/date-picker';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/ui/field';
import { exactMoney, documentLabels } from '@/features/commerce/business-types';

export const metadata = { title: 'Mua bán & công nợ' };
type TradingRow = {
  id: string;
  kind: string;
  date: string;
  total: string;
  paid: string;
  remaining: string;
  person: string;
  notes: string | null;
  sale_type: string | null;
};
export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePermission('view_operations');
  const params = await searchParams,
    today = businessDate();
  const unpaid = params.unpaid === '1';
  const from = dateSchema.safeParse(params.from).success
    ? params.from!
    : unpaid
      ? '2000-01-01'
      : `${today.slice(0, 7)}-01`;
  const to = dateSchema.safeParse(params.to).success ? params.to! : today;
  const kind = params.kind === 'SALE' || params.kind === 'PURCHASE' ? params.kind : '';
  const contact = z.uuid().safeParse(params.contact).success ? params.contact! : '';
  const page = /^\d{1,5}$/.test(params.page ?? '') ? Math.max(1, Number(params.page)) : 1;
  const db = await createClient();
  const result =
    from <= to
      ? await db.rpc('trading_history', {
          p_from: from,
          p_to: to,
          p_kind: kind || null,
          p_unpaid: unpaid,
          p_contact: contact || null,
          p_page: page,
        })
      : null;
  if (result?.error) throw new Error('Không tải được lịch sử mua bán.');
  const data = result?.data as {
    count: number;
    total: string;
    paid: string;
    receivable: string;
    payable: string;
    rows: TradingRow[];
  } | null;
  const href = (next: number) =>
    `/transactions?${new URLSearchParams({ from, to, kind, contact, unpaid: unpaid ? '1' : '', page: String(next) })}`;
  return (
    <div className="space-y-5">
      <PageHeader title="Mua bán & công nợ" icon={ShoppingBag} />
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
        <Link
          href="/transactions"
          className={`flex min-h-11 items-center justify-center rounded-xl text-sm font-semibold ${!unpaid ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'}`}
        >
          Lịch sử mua bán
        </Link>
        <Link
          href="/transactions?unpaid=1"
          className={`flex min-h-11 items-center justify-center rounded-xl text-sm font-semibold ${unpaid ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'}`}
        >
          Còn nợ
        </Link>
      </div>
      <Card className="!p-3">
        <form key={`${from}:${to}:${kind}:${unpaid}`} className="grid grid-cols-2 gap-3">
          <input type="hidden" name="contact" value={contact} />
          <Field id="tr-from" label="Từ ngày">
            <DatePicker id="tr-from" name="from" defaultValue={from} max={today} />
          </Field>
          <Field id="tr-to" label="Đến ngày">
            <DatePicker id="tr-to" name="to" defaultValue={to} max={today} />
          </Field>
          <Field id="tr-kind" label="Loại giao dịch">
            <Select id="tr-kind" name="kind" defaultValue={kind}>
              <option value="">Tất cả</option>
              <option value="SALE">Bán chiếu</option>
              <option value="PURCHASE">Mua hàng</option>
            </Select>
          </Field>
          <Field id="tr-unpaid" label="Thanh toán">
            <Select id="tr-unpaid" name="unpaid" defaultValue={unpaid ? '1' : ''} align="end">
              <option value="">Tất cả</option>
              <option value="1">Còn nợ</option>
            </Select>
          </Field>
          <Button type="submit" className="col-span-2 w-full font-bold shadow-xs">
            <Filter size={15} />
            Lọc giao dịch
          </Button>
        </form>
        {contact && (
          <Link href="/transactions" className="mt-3 block text-sm text-primary">
            Bỏ lọc khách hàng / nhà cung cấp
          </Link>
        )}
      </Card>
      {!data ? (
        <p role="alert" className="text-destructive">
          Kiểm tra khoảng ngày.
        </p>
      ) : (
        <>
          <ManagementMetrics
            items={[
              { label: 'Khách hàng\ncòn nợ tiền', value: exactMoney(data.receivable), emphasis: true },
              { label: 'Phải trả\nnhà cung cấp', value: exactMoney(data.payable) },
            ]}
          />
          <p className="text-xs text-muted-foreground">
            Theo ngày giao dịch đã chọn; số còn nợ đã trừ mọi lần thanh toán đến hiện tại.
          </p>
          <Card className="!p-3">
            <p className="px-1 pb-2 text-xs text-muted-foreground">{data.count} giao dịch</p>
            <div className="divide-y divide-border">
              {data.rows.map((row) => (
                <Link
                  key={row.id}
                  href={`/transactions/${row.id}`}
                  scroll={false}
                  className="block space-y-2 rounded-lg px-1 py-4 hover:bg-muted"
                >
                  <div className="flex flex-wrap justify-between gap-2 text-sm">
                    <strong>
                      {documentLabels[row.kind]}
                      {row.sale_type
                        ? ` · ${row.sale_type === 'RETAIL' ? 'Bán lẻ' : 'Bán sỉ'}`
                        : ''}
                    </strong>
                    <strong>{exactMoney(row.total)}</strong>
                  </div>
                  <p className="text-sm">{row.person}</p>
                  <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                    <span>{displayDate(row.date)}</span>
                    <span
                      className={
                        BigInt(row.remaining) > 0n
                          ? 'font-semibold text-amber-700 dark:text-amber-400'
                          : 'text-primary'
                      }
                    >
                      {BigInt(row.remaining) > 0n
                        ? `Còn nợ ${exactMoney(row.remaining)}`
                        : 'Đã thanh toán'}{' '}
                      ›
                    </span>
                  </div>
                </Link>
              ))}
              {!data.rows.length && (
                <div className="space-y-3 px-2 py-6 text-center">
                  <p className="text-sm font-semibold">
                    {unpaid
                      ? 'Không có khoản còn nợ trong khoảng ngày này'
                      : 'Chưa có giao dịch mua bán trong khoảng ngày này'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Trang này lưu mua chiếu và bán chiếu. Tiền mua lát, chỉ, vải, màu và trả công
                    xem tại Thu chi.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={`/transactions?${new URLSearchParams({ from: '2000-01-01', to: today, unpaid: unpaid ? '1' : '', contact })}`}
                      >
                        {unpaid ? 'Xem tất cả khoản nợ' : 'Xem toàn bộ lịch sử'}
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/cashflow">Xem thu chi</Link>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
          <div className="flex items-center justify-between">
            {page > 1 ? (
              <Link href={href(page - 1)} className="btn btn-outline">
                Trước
              </Link>
            ) : (
              <span />
            )}
            <span className="text-sm">Trang {page}</span>
            {page * 20 < data.count ? (
              <Link href={href(page + 1)} className="btn btn-outline">
                Sau
              </Link>
            ) : (
              <span />
            )}
          </div>
        </>
      )}
    </div>
  );
}
