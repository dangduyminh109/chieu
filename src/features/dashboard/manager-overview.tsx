import { OverviewTabs } from './overview-tabs';
import { ExpenseCategoryLabel } from '@/features/expenses/category-label';
import { DashboardWorkChart } from './work-chart';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { ManagementHeading, ManagementLink, ManagementMetrics } from '@/components/ui/management';
import { createClient } from '@/lib/supabase/server';
import { getManagerPayroll, wageMoney, wageTotals } from '@/features/payroll/manager-data';
import { StockOverviewCard, type StockOverview } from '@/features/inventory/stock-overview';

export async function ManagerOverview({ today, name }: { today: string; name: string }) {
  const month = today.slice(0, 7);
  const db = await createClient();
  const [workers, cash, stock, todayCash, todayWork, matTypesRes, debtResult, profitResult] =
    await Promise.all([
      getManagerPayroll(month),
      db.rpc('cashflow_ledger', { p_from: `${month}-01`, p_to: today, p_page: 1 }),
      db.rpc('production_stock_overview', { p_date: today }),
      db.rpc('cashflow_ledger', { p_from: today, p_to: today, p_page: 1 }),
      db
        .from('work_logs')
        .select('id,worker_id,created_at', { count: 'exact' })
        .eq('work_date', today)
        .in('status', ['APPROVED', 'LOCKED'])
        .order('created_at', { ascending: false })
        .order('id')
        .limit(6),
      db.from('mat_types').select('id,image_path,dimensions'),
      db.rpc('trading_history', { p_from: '2000-01-01', p_to: today, p_unpaid: true, p_page: 1 }),
      db.rpc('profit_report', { p_anchor: `${month}-01`, p_period: 'month' }),
    ]);
  if (cash.error) throw new Error('Không thể tải tổng quan thu chi.');
  if (stock.error) throw new Error('Không thể tải số lượng chiếu.');
  if (debtResult.error) throw new Error('Không thể tải công nợ.');
  if (profitResult.error) throw new Error('Không thể tải lãi bán.');
  const profit = profitResult.data as { revenue: string; cogs: string; missing_quantity: string };
  const debt = debtResult.data as { receivable: string; payable: string };
  if (todayCash.error || todayWork.error) throw new Error('Không thể tải lịch sử hôm nay.');

  const matMetaMap = new Map(
    (matTypesRes.data ?? []).map((m) => [
      m.id,
      { image_path: m.image_path, dimensions: m.dimensions },
    ]),
  );
  const rawStock = stock.data as StockOverview;
  const stockData: StockOverview = {
    ...rawStock,
    mats: (rawStock.mats ?? []).map((m) => ({
      ...m,
      image_path: matMetaMap.get(m.id)?.image_path ?? null,
      dimensions: matMetaMap.get(m.id)?.dimensions ?? null,
    })),
  };
  const cashHistory = todayCash.data as {
    income: string;
    expense: string;
    count: number;
    rows: {
      id: string;
      date: string;
      amount: string;
      direction: string;
      category: string;
      method: string;
      person: string;
      notes: string | null;
    }[];
  };
  const workMap = new Map(
    workers.flatMap((w) =>
      w.logs.map((l) => [l.id, { ...l, worker: w.name, workerId: w.id }] as const),
    ),
  );
  const ledger = cash.data as { income: string; expense: string };
  const logs = workers.flatMap((w) => w.logs);
  const totals = wageTotals(logs);
  const owed = workers
    .map((w) => ({ ...w, total: wageTotals(w.logs) }))
    .filter((w) => w.total.remaining > 0n)
    .sort((a, b) =>
      a.total.remaining > b.total.remaining ? -1 : a.total.remaining < b.total.remaining ? 1 : 0,
    );
  const stageTotals = new Map<string, number>();
  logs
    .filter((l) => l.date === today)
    .forEach((l) => stageTotals.set(l.stage, (stageTotals.get(l.stage) ?? 0) + l.quantity));
  const todayWorkers = workers.filter((w) => w.logs.some((l) => l.date === today)).length;
  return (
    <div className="space-y-5">
      <ManagementHeading
        title={`Chào ${name.split(' ').at(-1)}`}
        period={`Tháng ${Number(month.slice(5))}/${month.slice(0, 4)}`}
      />
      <OverviewTabs
        stock={<StockOverviewCard data={stockData} />}
        cashflow={
          <>
            <ManagementMetrics
              items={[
                {
                  label: 'Tiền thu\ntháng này',
                  value: wageMoney(ledger.income),
                  href: '/cashflow?direction=IN',
                  emphasis: true,
                },
                {
                  label: 'Tiền chi\ntháng này',
                  value: wageMoney(ledger.expense),
                  href: '/cashflow?direction=OUT',
                },
              ]}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-sm">
              <span className="text-muted-foreground">Chênh lệch thu − chi</span>
              <strong>{wageMoney(BigInt(ledger.income) - BigInt(ledger.expense))}</strong>
            </div>
            <Card className="space-y-3 !p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-bold">Thu chi hôm nay</h2>
                <span className="text-xs text-muted-foreground">{cashHistory.count} khoản</span>
              </div>
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted p-3 text-sm">
                <p>
                  <span className="block text-xs text-muted-foreground">Đã thu</span>
                  <strong className="mt-1 block text-primary">
                    {wageMoney(cashHistory.income)}
                  </strong>
                </p>
                <p>
                  <span className="block text-xs text-muted-foreground">Đã chi</span>
                  <strong className="mt-1 block">{wageMoney(cashHistory.expense)}</strong>
                </p>
              </div>
              <div className="divide-y divide-border">
                {cashHistory.rows.slice(0, 6).map((row) => (
                  <div key={row.id} className="py-3">
                    <div className="flex flex-wrap justify-between gap-2 text-sm">
                      <strong>
                        <ExpenseCategoryLabel name={row.category} />
                      </strong>
                      <strong
                        className={
                          row.direction === 'IN'
                            ? 'text-primary'
                            : 'text-amber-700 dark:text-amber-400'
                        }
                      >
                        {row.direction === 'IN' ? '+' : '−'}
                        {wageMoney(row.amount)}
                      </strong>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[row.person, row.method === 'BANK' ? 'Chuyển khoản' : 'Tiền mặt']
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    {row.notes && (
                      <p className="mt-1 line-clamp-2 break-words text-xs text-muted-foreground">
                        {row.notes}
                      </p>
                    )}
                  </div>
                ))}
                {!cashHistory.count && (
                  <p className="py-3 text-sm text-muted-foreground">
                    Hôm nay chưa có khoản thu chi.
                  </p>
                )}
              </div>
              <Link
                href={`/cashflow?from=${today}&to=${today}`}
                className="inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-primary"
              >
                Xem đầy đủ hôm nay
                <ArrowUpRight size={16} />
              </Link>
            </Card>
            <Card className="!p-2">
              <ManagementLink
                href="/cashflow"
                title="Xem sổ thu chi"
                detail="Lịch sử bán chiếu, mua hàng, chi phí và trả công"
              />
              <ManagementLink
                href="/transactions?unpaid=1&kind=SALE"
                title="Khách hàng còn nợ"
                detail={wageMoney(debt.receivable)}
              />
              <ManagementLink
                href="/transactions?unpaid=1&kind=PURCHASE"
                title="Còn phải trả nhà cung cấp"
                detail={wageMoney(debt.payable)}
              />
              <ManagementLink href="/transactions" title="Lịch sử mua / bán" />
              <ManagementLink
                href="/profit"
                title="Giá vốn & lãi bán tháng này"
                detail={
                  BigInt(profit.missing_quantity) > 0n
                    ? `Còn ${profit.missing_quantity} chiếc thiếu giá vốn`
                    : wageMoney(BigInt(profit.revenue) - BigInt(profit.cogs))
                }
              />
            </Card>
          </>
        }
        payroll={
          <>
            <ManagementMetrics
              items={[
                {
                  label: 'Tiền công\ntháng này',
                  value: wageMoney(totals.earned),
                  href: '/payroll',
                },
                {
                  label: 'Tiền công\nchưa trả',
                  value: wageMoney(totals.remaining),
                  href: '/payroll',
                  emphasis: true,
                },
              ]}
            />
            <Card className="!p-2">
              <ManagementLink
                href="/payroll"
                title="Công & lương"
                detail="Xem công từng thợ và ghi trả tiền"
              />
            </Card>
            <Card className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-bold">Công hôm nay</h2>
                <Link
                  href="/analytics"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-primary"
                >
                  Thống kê
                  <ArrowUpRight size={16} />
                </Link>
              </div>
              {stageTotals.size ? (
                <>
                  <p className="text-sm text-muted-foreground">{todayWorkers} thợ đã ghi công</p>
                  <div className="divide-y divide-border">
                    {Array.from(stageTotals, ([stage, quantity]) => (
                      <div key={stage} className="flex justify-between gap-3 py-3 text-sm">
                        <span>{stage}</span>
                        <strong>{quantity.toLocaleString('vi-VN')} chiếc</strong>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Hôm nay chưa có thợ ghi công.</p>
              )}
              {!!todayWork.data.length && (
                <div className="divide-y divide-border border-t border-border">
                  {todayWork.data.map((row) => {
                    const log = workMap.get(row.id);
                    if (!log) return null;
                    return (
                      <Link
                        key={row.id}
                        href={`/payroll?month=${month}&worker=${log.workerId}`}
                        className="block py-3 hover:text-primary"
                      >
                        <div className="flex flex-wrap justify-between gap-2 text-sm">
                          <strong>{log.worker}</strong>
                          <strong>{wageMoney(log.earned)}</strong>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {log.stage}
                          {log.mat ? ` · ${log.mat}` : ''} · {log.quantity.toLocaleString('vi-VN')}{' '}
                          chiếc
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Ghi lúc{' '}
                          {new Intl.DateTimeFormat('vi-VN', {
                            timeZone: 'Asia/Ho_Chi_Minh',
                            hour: '2-digit',
                            minute: '2-digit',
                          }).format(new Date(row.created_at))}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              )}
              <Link
                href={`/production?scope=team&from=${today}&to=${today}`}
                className="inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-primary"
              >
                Xem đủ {todayWork.count ?? 0} lượt ghi công hôm nay
                <ArrowUpRight size={16} />
              </Link>
            </Card>
            <DashboardWorkChart workers={workers} month={month} stageCatalog={stockData.stages} />
            <Card className="!p-3">
              <div className="flex items-center justify-between gap-3 px-1 pb-2">
                <h2 className="font-bold">Công tháng này chưa trả</h2>
                <span className="text-xs text-muted-foreground">{owed.length} thợ</span>
              </div>
              {owed.length ? (
                owed
                  .slice(0, 5)
                  .map((w) => (
                    <ManagementLink
                      key={w.id}
                      href={`/payroll?month=${month}&worker=${w.id}`}
                      title={w.name}
                      detail={wageMoney(w.total.remaining)}
                    />
                  ))
              ) : (
                <p className="px-1 py-3 text-sm text-muted-foreground">
                  Không có tiền công còn phải trả trong tháng.
                </p>
              )}
              {owed.length > 5 && <ManagementLink href="/payroll" title="Xem tất cả thợ" />}
            </Card>
          </>
        }
      />
    </div>
  );
}
