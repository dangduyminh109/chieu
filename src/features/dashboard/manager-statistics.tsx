'use client';
import { useId } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { BarChart3, Receipt, Wallet, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
  LabelList,
} from 'recharts';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { WorkerSelect } from '@/components/ui/worker-select';
import { Button } from '@/components/ui/button';
import { ManagementMetrics } from '@/components/ui/management';
import { StageIcon } from '@/features/production/stage-icon';
import type { ManagerStatistics, StatisticsTab } from './statistics-types';

const tabs = [
  { id: 'productivity', label: 'Năng suất', icon: BarChart3 },
  { id: 'cashflow', label: 'Thu chi', icon: Receipt },
  { id: 'payroll', label: 'Tiền công', icon: Wallet },
  { id: 'profit', label: 'Lãi bán', icon: BarChart3 },
] as const;
const money = (v: string | bigint) => `${BigInt(v).toLocaleString('vi-VN')} đ`;
const quantity = (v: string | bigint) => BigInt(v).toLocaleString('vi-VN');

export function ManagerStatisticsDashboard({
  data,
  tab,
  period,
  month,
  today,
  worker,
  stage,
}: {
  data: ManagerStatistics;
  tab: StatisticsTab;
  period: 'month' | 'year';
  month: string;
  today: string;
  worker: string;
  stage: string;
}) {
  const router = useRouter(),
    path = usePathname(),
    params = useSearchParams();
  const id = useId();
  const year = month.slice(0, 4);
  const isCurrent = period === 'year' ? year === today.slice(0, 4) : month === today.slice(0, 7);
  function update(values: Record<string, string>) {
    const query = new URLSearchParams(params.toString());
    Object.entries(values).forEach(([key, value]) =>
      value ? query.set(key, value) : query.delete(key),
    );
    router.replace(`${path}?${query}`, { scroll: false });
  }
  function shift(offset: number) {
    const date = new Date(`${month}-01T12:00:00Z`);
    if (period === 'year') {
      date.setUTCMonth(0);
      date.setUTCFullYear(date.getUTCFullYear() + offset);
    } else date.setUTCMonth(date.getUTCMonth() + offset);
    update({ month: date.toISOString().slice(0, 7) });
  }
  function chooseTab(value: string) {
    if (value === 'profit') router.push(`/profit?month=${month}&period=${period}`);
    else update({ tab: value });
  }
  const total = (key: 'quantity' | 'income' | 'expense' | 'earned' | 'paid' | 'remaining') =>
    data.points.reduce((sum, p) => sum + BigInt(p[key]), 0n);
  const stageName = data.stages.find((s) => s.id === stage)?.name ?? 'Sản lượng';
  const series =
    tab === 'productivity'
      ? [{ key: 'quantity', label: 'Số chiếc', color: 'var(--primary)' }]
      : tab === 'cashflow'
        ? [
            { key: 'income', label: 'Thu', color: '#216149' },
            { key: 'expense', label: 'Chi', color: '#c27819' },
          ]
        : [
            { key: 'earned', label: 'Tiền công', color: '#216149' },
            { key: 'remaining', label: 'Còn phải trả', color: '#c27819' },
          ];
  const points = data.points.map((p) => ({
    name:
      period === 'year' ? `T${Number(p.bucket.slice(5, 7))}` : String(Number(p.bucket.slice(8))),
    fullLabel:
      period === 'year'
        ? `Tháng ${Number(p.bucket.slice(5, 7))}/${year}`
        : `Ngày ${Number(p.bucket.slice(8))}/${Number(month.slice(5))}/${year}`,
    ...Object.fromEntries(
      series.flatMap((s) => [
        [s.key, Number(p[s.key as keyof typeof p])],
        [`${s.key}Text`, p[s.key as keyof typeof p]],
      ]),
    ),
  }));
  const hasData = series.some(
    (s) => total(s.key as 'quantity' | 'income' | 'expense' | 'earned' | 'remaining') > 0n,
  );
  const items =
    tab === 'productivity'
      ? [
          {
            label: `${stageName}\nTổng số chiếc`,
            value: `${quantity(total('quantity'))} chiếc`,
            emphasis: true,
          },
          { label: 'Số ngày\ncó ghi công', value: `${data.work_days} ngày` },
        ]
      : tab === 'cashflow'
        ? [
            { label: 'Tổng thu\ntrong kỳ', value: money(total('income')), emphasis: true },
            { label: 'Tổng chi\ntrong kỳ', value: money(total('expense')) },
          ]
        : [
            { label: 'Tiền công\nphát sinh', value: money(total('earned')) },
            { label: 'Tiền công\ncòn phải trả', value: money(total('remaining')), emphasis: true },
          ];
  const comparisonKey = tab === 'productivity' ? 'quantity' : 'earned';
  const comparison = [...data.comparison].sort((a, b) =>
    BigInt(a[comparisonKey]) > BigInt(b[comparisonKey])
      ? -1
      : BigInt(a[comparisonKey]) < BigInt(b[comparisonKey])
        ? 1
        : 0,
  );
  const max = BigInt(comparison[0]?.[comparisonKey] ?? '0');
  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Loại thống kê"
        className="grid grid-cols-4 gap-1 rounded-2xl border border-border bg-muted p-1"
      >
        {tabs.map((item, index) => (
          <button
            id={`${id}-${item.id}`}
            aria-controls={`${id}-panel`}
            aria-selected={tab === item.id}
            tabIndex={tab === item.id ? 0 : -1}
            role="tab"
            key={item.id}
            type="button"
            onClick={() => chooseTab(item.id)}
            onKeyDown={(event) => {
              const next =
                event.key === 'ArrowRight'
                  ? (index + 1) % tabs.length
                  : event.key === 'ArrowLeft'
                    ? (index + tabs.length - 1) % tabs.length
                    : event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? tabs.length - 1
                        : null;
              if (next !== null) {
                event.preventDefault();
                chooseTab(tabs[next].id);
                document.getElementById(`${id}-${tabs[next].id}`)?.focus();
              }
            }}
            className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-xs font-semibold sm:flex-row sm:gap-2 sm:text-sm ${tab === item.id ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <item.icon size={17} aria-hidden />
            <span className="whitespace-nowrap">{item.label}</span>
          </button>
        ))}
      </div>
      <Card className="space-y-3 !p-3 sm:!p-4">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
          {(['month', 'year'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={period === value}
              onClick={() => update({ period: value })}
              className={`min-h-9 rounded-lg px-3 text-sm font-semibold ${period === value ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'}`}
            >
              {value === 'month' ? 'Theo tháng' : 'Theo năm'}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] gap-2">
          <Button
            className="!px-0"
            variant="outline"
            disabled={period === 'year' ? year <= '2000' : month <= '2000-01'}
            aria-label={period === 'year' ? 'Năm trước' : 'Tháng trước'}
            onClick={() => shift(-1)}
          >
            <ChevronLeft size={18} />
          </Button>
          <Button
            className="min-w-0 !px-2"
            variant="outline"
            onClick={() => update({ month: today.slice(0, 7) })}
            title="Về kỳ hiện tại"
          >
            <RotateCcw size={15} />
            <span className="truncate">
              {period === 'year' ? `Năm ${year}` : `Tháng ${Number(month.slice(5))}/${year}`}
            </span>
          </Button>
          <Button
            className="!px-0"
            variant="outline"
            disabled={isCurrent}
            aria-label={period === 'year' ? 'Năm sau' : 'Tháng sau'}
            onClick={() => shift(1)}
          >
            <ChevronRight size={18} />
          </Button>
        </div>
        <div className={`grid gap-3 ${period === 'month' ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {period === 'month' && (
            <div className="min-w-0">
              <label htmlFor="stats-month" className="sr-only">
                Tháng
              </label>
              <Select
                id="stats-month"
                value={month.slice(5)}
                onValueChange={(value) => update({ month: `${year}-${value}` })}
              >
                {Array.from({ length: 12 }, (_, index) => (
                  <option
                    key={index}
                    value={String(index + 1).padStart(2, '0')}
                    disabled={year === today.slice(0, 4) && index + 1 > Number(today.slice(5, 7))}
                  >
                    Tháng {index + 1}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="min-w-0">
            <label htmlFor="stats-year" className="sr-only">
              Năm
            </label>
            <Select
              id="stats-year"
              align="end"
              value={year}
              onValueChange={(value) =>
                update({
                  month: `${value}-${value === today.slice(0, 4) && month.slice(5) > today.slice(5, 7) ? today.slice(5, 7) : month.slice(5)}`,
                })
              }
            >
              {Array.from(
                { length: Number(today.slice(0, 4)) - 1999 },
                (_, index) => Number(today.slice(0, 4)) - index,
              ).map((value) => (
                <option key={value} value={String(value)}>
                  Năm {value}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {tab !== 'cashflow' && (
          <div
            className={`grid gap-3 border-t border-border pt-3 ${tab === 'productivity' ? 'grid-cols-2' : 'grid-cols-1'}`}
          >
            <div className="min-w-0 space-y-1">
              <label htmlFor="stats-worker" className="text-xs text-muted-foreground">
                Thợ
              </label>
              <WorkerSelect
                id="stats-worker"
                workers={data.workers}
                value={worker}
                onValueChange={(value) => update({ worker: value })}
                allLabel="Tất cả thợ"
              />
            </div>
            {tab === 'productivity' && (
              <div className="min-w-0 space-y-1">
                <label htmlFor="stats-stage" className="text-xs text-muted-foreground">
                  Công đoạn
                </label>
                <Select
                  id="stats-stage"
                  align="end"
                  value={stage}
                  onValueChange={(value) => update({ stage: value })}
                  optionIcons={(val, small) => {
                    const s = data.stages.find((st) => st.id === val);
                    return s ? (
                      <StageIcon
                        name={s.name}
                        size={small ? 28 : 24}
                        className="rounded-md border border-border/70"
                      />
                    ) : null;
                  }}
                >
                  {data.stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>
        )}
      </Card>
      <div
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-${tab}`}
        tabIndex={0}
        className="space-y-4"
      >
        <ManagementMetrics items={items} />
        {tab === 'cashflow' && (
          <div className="flex flex-wrap justify-between gap-2 px-1 text-sm">
            <span className="text-muted-foreground">Chênh lệch thu − chi</span>
            <strong>{money(total('income') - total('expense'))}</strong>
          </div>
        )}
        {tab === 'payroll' && (
          <p className="px-1 text-xs text-muted-foreground">
            Đã ghi trả cho công kỳ này: <strong>{money(total('paid'))}</strong>. Khoản thợ xác nhận
            nhận tiền cũng được trừ khỏi số còn phải trả.
          </p>
        )}
        <Card className="min-w-0 space-y-3 !p-4">
          <h2 className="text-base font-bold">
            {tab === 'productivity'
              ? stageName
              : tab === 'cashflow'
                ? 'Thu và chi'
                : 'Tiền công và còn phải trả'}{' '}
            · {period === 'year' ? year : `${Number(month.slice(5))}/${year}`}
          </h2>
          <p className="text-xs text-muted-foreground">
            Đơn vị: {tab === 'productivity' ? 'chiếc chiếu' : 'đồng'} ·{' '}
            {period === 'year' ? '12 tháng trong năm' : 'Từng ngày trong tháng'}
          </p>
          <div className="overflow-x-auto" role="region" aria-label="Biểu đồ thống kê" tabIndex={0}>
            <div
              className="h-64"
              style={{ minWidth: period === 'year' ? 520 : Math.max(640, points.length * 28) }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={points} margin={{ left: 0, right: 12, top: 12, bottom: 8 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="name" interval={0} tick={{ fontSize: 12 }} />
                  <YAxis
                    allowDecimals={false}
                    width={58}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) =>
                      new Intl.NumberFormat('vi-VN', {
                        notation: 'compact',
                        maximumFractionDigits: 1,
                      }).format(Number(value))
                    }
                  />
                  <Tooltip
                    labelFormatter={(label, payload) => payload[0]?.payload.fullLabel ?? label}
                    formatter={(value, name, item) => {
                      const exact =
                        item.payload[`${String(item.dataKey)}Text`] ?? String(value ?? 0);
                      return [
                        tab === 'productivity'
                          ? `${quantity(String(exact))} chiếc`
                          : money(String(exact)),
                        name,
                      ];
                    }}
                    contentStyle={{
                      background: 'var(--card)',
                      borderColor: 'var(--border)',
                      color: 'var(--foreground)',
                    }}
                  />
                  {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
                  {series.map((s) => (
                    <Bar
                      key={s.key}
                      dataKey={s.key}
                      name={s.label}
                      fill={s.color}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                      isAnimationActive={false}
                    >
                      {tab === 'productivity' && (
                        <LabelList
                          dataKey={s.key}
                          position="top"
                          offset={4}
                          formatter={(val: unknown) =>
                            Number(val) > 0 ? Number(val).toLocaleString('vi-VN') : ''
                          }
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            fill: 'var(--text-primary)',
                          }}
                        />
                      )}
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          {!hasData && (
            <p className="text-center text-sm text-muted-foreground">
              Chưa có dữ liệu trong kỳ này.
            </p>
          )}
          <p className="text-xs text-muted-foreground">Vuốt ngang để xem đầy đủ.</p>
        </Card>
        {tab !== 'cashflow' && comparison.length > 0 && (
          <Card className="space-y-4 !p-4">
            <h2 className="font-bold">
              {tab === 'productivity' ? 'Sản lượng từng thợ' : 'Tiền công từng thợ'}
            </h2>
            {comparison.map((w) => (
              <div key={w.id} className="space-y-1.5">
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <span>{w.name}</span>
                  <strong>
                    {tab === 'productivity' ? `${quantity(w.quantity)} chiếc` : money(w.earned)}
                  </strong>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${max > 0n ? Number((BigInt(w[comparisonKey]) * 10000n) / max) / 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </Card>
        )}
        {tab === 'cashflow' && (
          <p className="text-xs text-muted-foreground">
            Thu chi tính theo ngày tiền thực nhận/thực trả của toàn cơ sở, gồm trả công. Chênh lệch
            chưa phải lợi nhuận.
          </p>
        )}
        {tab === 'payroll' && (
          <p className="text-xs text-muted-foreground">
            Tiền công tính theo ngày làm. Số đã trả và còn phải trả phản ánh tình trạng hiện tại của
            công trong kỳ đã chọn.
          </p>
        )}
      </div>
    </div>
  );
}
