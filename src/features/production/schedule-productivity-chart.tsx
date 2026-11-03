'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CalendarArrowRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { money, number, displayDate } from '@/lib/utils';
import { getPersonalProductivityChart } from './chart-actions';
import { chartRange, shiftChartPeriod } from './chart-period';

export function ScheduleProductivityChart({
  stageName,
  stageId,
  month,
  today,
}: {
  stageName: string;
  stageId?: string;
  month: string;
  today: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawTab = searchParams.get('chart');
  const chartTab: 'week' | 'month' | 'year' =
    rawTab === 'month' || rawTab === 'year' ? rawTab : 'week';

  function setChartTab(tab: 'week' | 'month' | 'year') {
    const params = new URLSearchParams(window.location.search);
    params.set('chart', tab);
    router.replace('?' + params.toString(), { scroll: false });
  }

  const requestedDate = searchParams.get('chart_date');
  const anchor =
    requestedDate &&
    /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) &&
    !Number.isNaN(Date.parse(requestedDate))
      ? requestedDate
      : month === today.slice(0, 7)
        ? today
        : `${month}-01`;

  const chartKey = `${anchor}:${chartTab}:${stageId ?? ''}`;
  const [chartResult, setChartResult] = useState<{
    key: string;
    points: { name: string; quantity: number; amount: number; fullDate?: string }[];
    error?: string;
  }>({ key: '', points: [] });

  useEffect(() => {
    let cancelled = false;
    getPersonalProductivityChart({ anchor, period: chartTab, stageId })
      .then((result) => {
        if (!cancelled) setChartResult({ key: chartKey, points: result.points });
      })
      .catch(() => {
        if (!cancelled)
          setChartResult({
            key: chartKey,
            points: [],
            error: 'Không tải được biểu đồ. Hãy thử lại.',
          });
      });
    return () => {
      cancelled = true;
    };
  }, [anchor, chartTab, stageId, chartKey]);

  const chartData = chartResult.key === chartKey ? chartResult.points : [];
  const chartRangeValue = chartRange(anchor, chartTab);
  const isCurrentPeriod =
    chartTab === 'year'
      ? anchor.slice(0, 4) === today.slice(0, 4)
      : chartTab === 'month'
        ? anchor.slice(0, 7) === today.slice(0, 7)
        : chartRange(anchor, 'week').start === chartRange(today, 'week').start;

  let chartPeriodBtnLabel = '';
  if (isCurrentPeriod) {
    if (chartTab === 'year') {
      chartPeriodBtnLabel = `${today.slice(0, 4)} · Hiện tại`;
    } else if (chartTab === 'month') {
      chartPeriodBtnLabel = `Tháng ${Number(today.slice(5, 7))}/${today.slice(0, 4)} · Hiện tại`;
    } else {
      chartPeriodBtnLabel = 'Tuần này · Hiện tại';
    }
  } else {
    if (chartTab === 'year') {
      chartPeriodBtnLabel = `Về năm ${today.slice(0, 4)}`;
    } else if (chartTab === 'month') {
      chartPeriodBtnLabel = `Về tháng ${Number(today.slice(5, 7))}/${today.slice(0, 4)}`;
    } else {
      chartPeriodBtnLabel = 'Về tuần này';
    }
  }

  const periodLabel =
    chartTab === 'week'
      ? `${displayDate(chartRangeValue.start)} – ${displayDate(chartRangeValue.end)}`
      : chartTab === 'month'
        ? `Tháng ${Number(anchor.slice(5, 7))}/${anchor.slice(0, 4)}`
        : `Năm ${anchor.slice(0, 4)}`;

  function goChart(delta: number) {
    const next = shiftChartPeriod(anchor, chartTab, delta);
    if (next < '2000-01-01' || next > today) return;
    const params = new URLSearchParams(window.location.search);
    params.set('chart_date', next);
    params.set('chart', chartTab);
    router.replace('?' + params.toString(), { scroll: false });
  }

  function resetChart() {
    const params = new URLSearchParams(window.location.search);
    params.set('chart_date', today);
    router.replace('?' + params.toString(), { scroll: false });
  }

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-3">
        <div>
          <h3 className="text-base font-bold text-foreground">
            Năng suất {stageName.toLowerCase()}
          </h3>
          <p className="text-xs text-muted-foreground">{periodLabel}</p>
        </div>

        <div className="flex rounded-xl bg-muted p-1 text-xs font-semibold self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setChartTab('week')}
            className={`rounded-lg px-3 py-1.5 transition-all ${
              chartTab === 'week'
                ? 'bg-card text-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Theo Tuần
          </button>
          <button
            type="button"
            onClick={() => setChartTab('month')}
            className={`rounded-lg px-3 py-1.5 transition-all ${
              chartTab === 'month'
                ? 'bg-card text-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Theo Tháng
          </button>
          <button
            type="button"
            onClick={() => setChartTab('year')}
            className={`rounded-lg px-3 py-1.5 transition-all ${
              chartTab === 'year'
                ? 'bg-card text-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Theo Năm
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-[36px_minmax(0,1fr)_36px] sm:grid-cols-[40px_minmax(0,1fr)_40px] items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => goChart(-1)}
          disabled={shiftChartPeriod(anchor, chartTab, -1) < '2000-01-01'}
          aria-label="Xem kỳ trước"
          className="size-9 sm:size-10 !p-0 rounded-xl flex items-center justify-center shrink-0 border-border hover:bg-muted active:scale-95"
        >
          <ChevronLeft size={18} className="stroke-[2.5]" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={resetChart}
          className="h-9 sm:h-10 min-w-0 w-full whitespace-nowrap rounded-xl border-primary/30 bg-primary/10 px-3 text-xs sm:text-sm font-semibold text-primary hover:bg-primary/20 flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-2xs"
          aria-label={`Về ${chartTab === 'year' ? 'năm ' + today.slice(0, 4) : chartTab === 'month' ? 'tháng ' + Number(today.slice(5, 7)) + '/' + today.slice(0, 4) : 'tuần hiện tại'}`}
        >
          {isCurrentPeriod ? (
            <CalendarDays size={14} className="stroke-[2.2] shrink-0" aria-hidden />
          ) : (
            <CalendarArrowRight size={14} className="stroke-[2.2] shrink-0" aria-hidden />
          )}
          <span>{chartPeriodBtnLabel}</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => goChart(1)}
          disabled={shiftChartPeriod(anchor, chartTab, 1) > today}
          aria-label="Xem kỳ sau"
          className="size-9 sm:size-10 !p-0 rounded-xl flex items-center justify-center shrink-0 border-border hover:bg-muted active:scale-95"
        >
          <ChevronRight size={18} className="stroke-[2.5]" />
        </Button>
      </div>

      {chartResult.key !== chartKey && (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          Đang tải biểu đồ…
        </p>
      )}
      {chartResult.key === chartKey && chartResult.error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {chartResult.error}
        </p>
      )}

      {/* Scroll hint on mobile */}
      {(chartTab === 'month' || chartTab === 'year') && (
        <div className="mt-2 text-[11px] font-medium text-muted-foreground sm:hidden text-center">
          {chartTab === 'month'
            ? '← Vuốt ngang để xem đủ ngày trong tháng →'
            : '← Vuốt ngang để xem đủ 12 tháng trong năm →'}
        </div>
      )}

      {/* Horizontal scrollable wrapper for chart (scroll-x) */}
      <div className="mt-4 w-full overflow-x-auto pb-2 scroll-smooth">
        <div
          className={`h-64 ${
            chartTab === 'month'
              ? 'min-w-[820px]'
              : chartTab === 'year'
                ? 'min-w-[500px] sm:min-w-full'
                : 'min-w-full'
          }`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                className="stroke-border/40"
              />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                interval={0}
                className="text-[11px] font-medium fill-muted-foreground"
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                className="text-[11px] font-medium fill-muted-foreground"
              />
              <Tooltip
                cursor={{ fill: 'var(--color-muted)', opacity: 0.3 }}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const data = payload[0].payload;
                  return (
                    <div className="rounded-xl border border-border bg-card p-3 shadow-lg text-xs space-y-1">
                      <p className="font-bold text-foreground">{data.fullDate || data.name}</p>
                      <p className="text-primary font-semibold">
                        Số lượng: <strong>{number(data.quantity)} chiếc</strong>
                      </p>
                      <p className="text-muted-foreground">Tiền công: {money(data.amount)}</p>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="quantity"
                fill="var(--color-primary)"
                radius={[6, 6, 0, 0]}
                maxBarSize={chartTab === 'month' ? 18 : 45}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}
