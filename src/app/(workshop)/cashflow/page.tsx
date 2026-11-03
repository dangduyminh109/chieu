import Link from 'next/link';
import { ExpenseCategoryLabel } from '@/features/expenses/category-label';
import { Receipt, Filter, ChevronDown } from 'lucide-react';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { businessDate, displayDate } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ManagementMetrics } from '@/components/ui/management';
import { DatePicker } from '@/components/ui/date-picker';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/ui/field';
import { dateSchema } from '@/features/production/schemas';
import { PageHeader } from '@/components/ui/page-header';

export const metadata = { title: 'Thu chi' };

type Entry = {
  id: string;
  date: string;
  amount: string;
  direction: 'IN' | 'OUT';
  method: string;
  category: string;
  notes: string | null;
  person: string;
};
type Ledger = { income: string; expense: string; count: number; rows: Entry[] };

const cash = (n: string | bigint) => `${BigInt(n).toLocaleString('vi-VN')} đ`;

export default async function CashflowPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePermission('view_financials');
  const params = await searchParams;
  const today = businessDate();
  const from = dateSchema.safeParse(params.from).success ? params.from! : `${today.slice(0, 7)}-01`;
  const to = dateSchema.safeParse(params.to).success ? params.to! : today;
  const direction = ['IN', 'OUT'].includes(params.direction ?? '') ? params.direction! : '';
  const method = ['CASH', 'BANK'].includes(params.method ?? '') ? params.method! : '';
  const page = /^\d{1,5}$/.test(params.page ?? '') ? Math.max(1, Number(params.page)) : 1;
  const db = await createClient();
  const result =
    from <= to
      ? await db.rpc('cashflow_ledger', {
          p_from: from,
          p_to: to,
          p_direction: direction || null,
          p_method: method || null,
          p_page: page,
        })
      : null;
  if (result?.error) throw new Error('Không tải được sổ thu chi.');
  const ledger = result?.data as Ledger | null;

  function pageLink(next: number) {
    const query = new URLSearchParams({ from, to, direction, method, page: String(next) });
    return `/cashflow?${query}`;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Thu chi"
        description={`Sổ thu chi từ ${displayDate(from)} đến ${displayDate(to)}`}
        icon={Receipt}
      />
      <Card className="!p-3 sm:!p-4">
        <details className="group" open={from > to || undefined}>
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-lg text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Filter size={18} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Bộ lọc</span>
              <span className="block text-xs text-muted-foreground">
                {direction === 'IN'
                  ? 'Khoản thu'
                  : direction === 'OUT'
                    ? 'Khoản chi'
                    : 'Tất cả thu chi'}
                {' · '}
                {method === 'CASH'
                  ? 'Tiền mặt'
                  : method === 'BANK'
                    ? 'Chuyển khoản'
                    : 'Mọi hình thức'}
              </span>
            </span>
            <ChevronDown
              size={18}
              aria-hidden="true"
              className="shrink-0 text-muted-foreground group-open:rotate-180"
            />
          </summary>
          <form
            key={`${from}:${to}:${direction}:${method}`}
            className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"
          >
            <Field id="cash-from" label="Từ ngày">
              <DatePicker id="cash-from" name="from" defaultValue={from} max={today} />
            </Field>
            <Field id="cash-to" label="Đến ngày">
              <DatePicker id="cash-to" name="to" defaultValue={to} max={today} />
            </Field>
            <Field id="cash-direction" label="Khoản tiền">
              <Select id="cash-direction" name="direction" defaultValue={direction}>
                <option value="">Tất cả</option>
                <option value="IN">Thu</option>
                <option value="OUT">Chi</option>
              </Select>
            </Field>
            <Field id="cash-method" label="Thanh toán">
              <Select id="cash-method" name="method" defaultValue={method}>
                <option value="">Tất cả</option>
                <option value="CASH">Tiền mặt</option>
                <option value="BANK">Chuyển khoản</option>
              </Select>
            </Field>
            <Button type="submit" className="col-span-2 sm:col-span-4 w-full font-bold shadow-xs">
              <Filter size={15} />
              Áp dụng bộ lọc
            </Button>
          </form>
        </details>
      </Card>
      {!ledger ? (
        <p role="alert" className="text-destructive">
          Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.
        </p>
      ) : (
        <>
          <ManagementMetrics
            items={[
              { label: 'Tổng thu\ntrong kỳ', value: cash(ledger.income), emphasis: true },
              { label: 'Tổng chi\ntrong kỳ', value: cash(ledger.expense) },
            ]}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-sm">
            <span className="text-muted-foreground">Chênh lệch thu − chi</span>
            <strong>{cash(BigInt(ledger.income) - BigInt(ledger.expense))}</strong>
          </div>
          <Card className="!p-4">
            <h2 className="font-bold">Lịch sử thu chi · {ledger.count} khoản</h2>
            <div className="mt-3 divide-y divide-border">
              {ledger.rows.length ? (
                ledger.rows.map((r) => (
                  <div key={r.id} className="py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <strong className="block text-sm">
                          <ExpenseCategoryLabel name={r.category} />
                        </strong>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {displayDate(r.date)} ·{' '}
                          {r.method === 'BANK' ? 'Chuyển khoản' : 'Tiền mặt'}
                        </p>
                        {r.person && <p className="mt-1 text-sm">{r.person}</p>}
                      </div>
                      <strong
                        className={`ml-auto max-w-full break-words text-sm tabular-nums ${r.direction === 'IN' ? 'text-primary' : 'text-amber-700 dark:text-amber-400'}`}
                      >
                        {r.direction === 'IN' ? '+' : '−'}
                        {cash(r.amount)}
                      </strong>
                    </div>
                    {r.notes && (
                      <p className="mt-2 break-words text-xs text-muted-foreground">{r.notes}</p>
                    )}
                  </div>
                ))
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Chưa có khoản thu chi trong khoảng này.
                </p>
              )}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              {page > 1 ? (
                <Link className="btn btn-outline" href={pageLink(page - 1)}>
                  Trước
                </Link>
              ) : (
                <span />
              )}
              <span className="text-sm">Trang {page}</span>
              {page * 30 < ledger.count ? (
                <Link className="btn btn-outline" href={pageLink(page + 1)}>
                  Sau
                </Link>
              ) : (
                <span />
              )}
            </div>
          </Card>
          <p className="text-xs text-muted-foreground">
            Chỉ tính khoản đã thu/chi. Chênh lệch này chưa phải lợi nhuận.
          </p>
        </>
      )}
    </div>
  );
}
