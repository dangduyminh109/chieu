'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { ManagementMetrics } from '@/components/ui/management';
import { exactMoney } from '@/features/commerce/business-types';
import { displayDate } from '@/lib/utils';

export type ProfitReport = {
  revenue: string;
  cogs: string;
  expenses: string;
  missing_quantity: string;
  missing_documents: number;
  points: {
    bucket: string;
    revenue: string;
    cogs: string;
    expenses: string;
    missing: string;
    gross: string | null;
    profit: string | null;
  }[];
  by_mat: {
    id: string;
    name: string;
    quantity: string;
    revenue: string;
    cogs: string;
    missing: string;
  }[];
  missing_sales: { id: string; business_date: string }[];
};

export function ProfitDashboard({
  data,
  month,
  period,
  today,
}: {
  data: ProfitReport;
  month: string;
  period: 'month' | 'year';
  today: string;
}) {
  const router = useRouter(),
    params = useSearchParams();
  const year = month.slice(0, 4);
  const missing = BigInt(data.missing_quantity) > 0n;
  const gross = BigInt(data.revenue) - BigInt(data.cogs);
  const net = gross - BigInt(data.expenses);
  const current = period === 'year' ? year === today.slice(0, 4) : month === today.slice(0, 7);
  function update(values: Record<string, string>, reset = true) {
    const query = new URLSearchParams(params.toString());
    Object.entries(values).forEach(([key, value]) => query.set(key, value));
    if (reset) query.delete('missing_page');
    router.replace(`/profit?${query}`, { scroll: false });
  }
  function shift(offset: number) {
    const d = new Date(`${month}-01T12:00:00Z`);
    if (period === 'year') {
      d.setUTCMonth(0);
      d.setUTCFullYear(d.getUTCFullYear() + offset);
    } else d.setUTCMonth(d.getUTCMonth() + offset);
    update({ month: d.toISOString().slice(0, 7) });
  }
  const points = data.points.map((p) => ({
    name:
      period === 'year' ? `T${Number(p.bucket.slice(5, 7))}` : String(Number(p.bucket.slice(8))),
    fullLabel:
      period === 'year'
        ? `Tháng ${Number(p.bucket.slice(5, 7))}/${year}`
        : `Ngày ${Number(p.bucket.slice(8))}/${Number(month.slice(5))}/${year}`,
    revenue: Number(p.revenue),
    cogs: BigInt(p.missing) > 0n ? null : Number(p.cogs),
    gross: p.gross === null ? null : Number(p.gross),
    revenueText: p.revenue,
    cogsText: p.cogs,
    grossText: p.gross,
  }));
  return (
    <div className="space-y-4">
      <nav
        aria-label="Loại thống kê"
        className="grid grid-cols-4 gap-1 rounded-2xl border border-border bg-muted p-1"
      >
        {[
          { id: 'productivity', label: 'Năng suất' },
          { id: 'cashflow', label: 'Thu chi' },
          { id: 'payroll', label: 'Tiền công' },
          { id: 'profit', label: 'Lãi bán' },
        ].map((tab) => (
          <Link
            key={tab.id}
            href={
              tab.id === 'profit'
                ? `/profit?month=${month}&period=${period}`
                : `/analytics?tab=${tab.id}&month=${month}&period=${period}`
            }
            aria-current={tab.id === 'profit' ? 'page' : undefined}
            className={`flex min-h-11 min-w-0 items-center justify-center whitespace-nowrap rounded-xl px-1 text-xs font-semibold sm:text-sm ${tab.id === 'profit' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'}`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      <Card className="space-y-3 !p-3">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
          {(['month', 'year'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={period === value}
              onClick={() => update({ period: value })}
              className={`min-h-9 rounded-lg text-sm font-semibold ${period === value ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'}`}
            >
              {value === 'month' ? 'Theo tháng' : 'Theo năm'}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] gap-2">
          <Button
            variant="outline"
            className="!px-0"
            aria-label="Kỳ trước"
            onClick={() => shift(-1)}
            disabled={period === 'year' ? year <= '2000' : month <= '2000-01'}
          >
            <ChevronLeft size={18} />
          </Button>
          <Button
            variant="outline"
            className="min-w-0 !px-2"
            title="Về hiện tại"
            onClick={() => update({ month: today.slice(0, 7) })}
          >
            <RotateCcw size={15} />
            <span className="truncate">
              {period === 'year' ? `Năm ${year}` : `Tháng ${Number(month.slice(5))}/${year}`}
            </span>
          </Button>
          <Button
            variant="outline"
            className="!px-0"
            aria-label="Kỳ sau"
            onClick={() => shift(1)}
            disabled={current}
          >
            <ChevronRight size={18} />
          </Button>
        </div>
        <div className={`grid gap-3 ${period === 'month' ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {period === 'month' && (
            <Select
              id="profit-month"
              value={month.slice(5)}
              onValueChange={(value) => update({ month: `${year}-${value}` })}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1)
                .filter((value) => year < today.slice(0, 4) || value <= Number(today.slice(5, 7)))
                .map((value) => (
                  <option key={value} value={String(value).padStart(2, '0')}>
                    Tháng {value}
                  </option>
                ))}
            </Select>
          )}
          <Select
            id="profit-year"
            value={year}
            align="end"
            onValueChange={(value) =>
              update({
                month: `${value}-${value === today.slice(0, 4) && month.slice(5) > today.slice(5, 7) ? today.slice(5, 7) : month.slice(5)}`,
              })
            }
          >
            {Array.from(
              { length: Number(today.slice(0, 4)) - 1999 },
              (_, i) => Number(today.slice(0, 4)) - i,
            ).map((value) => (
              <option key={value} value={String(value)}>
                Năm {value}
              </option>
            ))}
          </Select>
        </div>
      </Card>
      {missing && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
          Còn {BigInt(data.missing_quantity).toLocaleString('vi-VN')} chiếc đã bán chưa có giá vốn.
          Chưa thể tính đủ lãi cho kỳ này.
        </div>
      )}
      <ManagementMetrics
        items={[
          { label: 'Doanh thu bán chiếu', value: exactMoney(data.revenue) },
          {
            label: missing ? 'Giá vốn đã biết' : 'Giá vốn chiếu đã bán',
            value: exactMoney(data.cogs),
          },
          {
            label: 'Lãi bán theo giá vốn nhập',
            value: missing ? 'Chưa đủ giá vốn' : exactMoney(gross),
            emphasis: !missing,
          },
          { label: 'Sau chi phí khác', value: missing ? 'Chưa đủ giá vốn' : exactMoney(net) },
        ]}
      />
      <p className="text-xs text-muted-foreground">
        Chi phí khác trong kỳ: <strong>{exactMoney(data.expenses)}</strong>. Doanh thu gồm cả đơn
        khách còn nợ, không phải số tiền đã thu.
      </p>
      <Card className="min-w-0 space-y-3 !p-4">
        <h2 className="font-bold">Doanh thu, giá vốn và lãi bán</h2>
        <p className="text-xs text-muted-foreground">
          Đơn vị: đồng ·{' '}
          {period === 'year'
            ? `12 tháng năm ${year}`
            : `Từng ngày tháng ${Number(month.slice(5))}/${year}`}
        </p>
        <div
          className="overflow-x-auto"
          role="region"
          aria-label="Biểu đồ lãi bán chiếu"
          tabIndex={0}
        >
          <div
            className="h-64"
            style={{ minWidth: period === 'year' ? 600 : Math.max(640, points.length * 30) }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={points} margin={{ top: 12, left: 0, right: 12, bottom: 8 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="name" interval={0} tick={{ fontSize: 12 }} />
                <YAxis
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
                  formatter={(value, name, item) => [
                    exactMoney(item.payload[`${String(item.dataKey)}Text`] ?? String(value ?? 0)),
                    name,
                  ]}
                  contentStyle={{
                    background: 'var(--card)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="revenue"
                  name="Doanh thu"
                  fill="#3b82a0"
                  maxBarSize={20}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="cogs"
                  name="Giá vốn"
                  fill="#c27819"
                  maxBarSize={20}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="gross"
                  name="Lãi / lỗ bán"
                  fill="#216149"
                  maxBarSize={20}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Vuốt ngang để xem đủ. Ngày/tháng thiếu giá vốn chỉ hiển thị doanh thu.
        </p>
      </Card>
      <Card className="!p-4">
        <h2 className="font-bold">Theo loại chiếu</h2>
        <div className="mt-2 divide-y divide-border">
          {data.by_mat.map((m) => (
            <div key={m.id} className="space-y-2 py-3">
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <strong>{m.name}</strong>
                <span>{BigInt(m.quantity).toLocaleString('vi-VN')} chiếc</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <p>
                  Doanh thu
                  <br />
                  <strong className="text-foreground">{exactMoney(m.revenue)}</strong>
                </p>
                <p>
                  Giá vốn {BigInt(m.missing) > 0n ? 'đã biết' : ''}
                  <br />
                  <strong className="text-foreground">{exactMoney(m.cogs)}</strong>
                </p>
              </div>
              <p className="text-sm font-semibold text-primary">
                {BigInt(m.missing) > 0n
                  ? `Còn ${m.missing} chiếc thiếu giá vốn`
                  : `Lãi bán: ${exactMoney(BigInt(m.revenue) - BigInt(m.cogs))}`}
              </p>
            </div>
          ))}
          {!data.by_mat.length && (
            <p className="py-4 text-sm text-muted-foreground">Chưa bán chiếu trong kỳ này.</p>
          )}
        </div>
      </Card>
      {data.missing_documents > 0 && (
        <Card className="!p-4">
          <h2 className="font-bold">Phiếu cần bổ sung giá vốn · {data.missing_documents}</h2>
          <div className="mt-2 divide-y divide-border">
            {data.missing_sales.map((s) => (
              <Link
                key={s.id}
                href={`/transactions/${s.id}`}
                className="flex min-h-12 items-center justify-between gap-2 py-3 text-sm"
              >
                <span>Đơn bán ngày {displayDate(s.business_date)}</span>
                <strong className="text-primary">Nhập giá vốn ›</strong>
              </Link>
            ))}
          </div>
          {data.missing_documents > 20 && (
            <p className="text-xs text-muted-foreground">
              Đang hiện 20 phiếu thiếu giá vốn gần nhất. Bổ sung xong, danh sách sẽ hiện các phiếu
              tiếp theo.
            </p>
          )}
        </Card>
      )}
      <Card className="space-y-3 !p-4">
        <Link href="/mat-types" className="text-sm font-semibold text-primary">
          Thiết lập giá vốn từng loại chiếu ›
        </Link>
        <details>
          <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
            Cách tính và lưu ý
          </summary>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Lãi bán = doanh thu − giá vốn của số chiếu đã bán. Giá vốn mỗi chiếc do chủ nhập, đã gồm
            nguyên liệu và tiền công; không trừ lại các khoản này khi chi tiền. Sau chi phí khác =
            lãi bán − các phiếu chi Sửa máy, Khác và chi phí vận hành khác; loại trừ Mua lát, Mua
            chỉ, Mua màu và Mua vải may chiếu. Thay giá vốn trong Loại chiếu chỉ áp dụng cho phiếu
            bán mới. Đơn cũ cần bổ sung/điều chỉnh ngay trên phiếu.
          </p>
        </details>
      </Card>
    </div>
  );
}
