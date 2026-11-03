'use client';

import { useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Wallet,
  Check,
  CheckCheck,
  Clock,
  Calendar,
  ChevronLeft,
  ChevronRight,
  BarChart3,
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
import { useDismissPicker } from '@/components/ui/select';
import { money } from '@/lib/utils';
import { vnd, formatYAxis, type WageMonth } from './types';

export function WagesYearlyChart({
  selectedYearMonths,
  currentYear,
  selectedYear,
}: {
  selectedYearMonths: WageMonth[];
  currentYear: number;
  selectedYear: number;
}) {
  const router = useRouter();

  function handleNavigateYear(delta: number) {
    const nextYear = selectedYear + delta;
    const params = new URLSearchParams(window.location.search);
    params.set('year', String(nextYear));
    params.set('tab', 'year');
    router.push(`?${params.toString()}`);
  }

  const yearPickerRef = useRef<HTMLDetailsElement>(null);
  useDismissPicker(yearPickerRef);

  function selectYear(year: number) {
    if (yearPickerRef.current) yearPickerRef.current.open = false;
    const params = new URLSearchParams(window.location.search);
    if (year === currentYear) {
      params.delete('year');
    } else {
      params.set('year', String(year));
    }
    params.set('tab', 'year');
    router.push(`?${params.toString()}`);
  }

  const availableYears = useMemo(() => {
    const set = new Set([
      currentYear - 4,
      currentYear - 3,
      currentYear - 2,
      currentYear - 1,
      currentYear,
      currentYear + 1,
      selectedYear,
    ]);
    return Array.from(set).sort((a, b) => a - b);
  }, [currentYear, selectedYear]);

  // Annual Totals for Selected Year
  const totalEarnedYear = selectedYearMonths.reduce(
    (acc, m) => acc + BigInt(m.earned || '0'),
    0n,
  );
  const totalReceivedYear = selectedYearMonths.reduce(
    (acc, m) => acc + BigInt(m.received || '0'),
    0n,
  );
  const totalRemainingYear = selectedYearMonths.reduce(
    (acc, m) => acc + BigInt(m.remaining || '0'),
    0n,
  );
  const totalRecordsYear = selectedYearMonths.reduce((acc, m) => acc + (m.records || 0), 0);
  const percentYear =
    totalEarnedYear > 0n
      ? Math.min(100, Math.round(Number((totalReceivedYear * 100n) / totalEarnedYear)))
      : 0;

  // Chart data (12 months T1 -> T12 of selected year)
  const chartData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const mNum = i + 1;
      const monthKey = `${selectedYear}-${String(mNum).padStart(2, '0')}`;
      const found = selectedYearMonths.find((m) => m.month === monthKey);
      const earned = found ? Number(found.earned || 0) : 0;
      const received = found ? Number(found.received || 0) : 0;
      const remaining = found ? Number(found.remaining || 0) : 0;
      const records = found ? found.records : 0;
      return {
        name: `T${mNum}`,
        fullName: `Tháng ${mNum}/${selectedYear}`,
        monthKey,
        earned,
        received,
        remaining,
        records,
      };
    });
  }, [selectedYear, selectedYearMonths]);

  return (
    <div className="space-y-6">
      {/* Year Navigator Controls */}
      <div className="flex items-center justify-between bg-card p-3 rounded-2xl border border-border/80 shadow-2xs gap-2">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider shrink-0">
          Chọn năm
        </span>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleNavigateYear(-1)}
            aria-label="Năm trước"
            className="size-9 p-0 rounded-xl"
          >
            <ChevronLeft size={18} />
          </Button>

          {/* Year Dropdown Picker */}
          <details ref={yearPickerRef} className="relative min-w-0">
            <summary
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card text-sm font-bold text-foreground shadow-2xs whitespace-nowrap cursor-pointer hover:border-primary/50 list-none [&::-webkit-details-marker]:hidden"
              aria-label="Mở danh sách năm"
            >
              <Calendar size={16} className="text-primary shrink-0" />
              <span>{selectedYear}</span>
            </summary>

            <div
              className="absolute right-0 sm:left-1/2 sm:-translate-x-1/2 z-50 mt-1.5 w-56 rounded-2xl border border-border bg-card p-3 shadow-xl"
              role="group"
              aria-label="Danh sách năm"
            >
              <div className="grid grid-cols-3 gap-1.5 text-center">
                {availableYears.map((y) => {
                  const isSelected = y === selectedYear;
                  const isCurrent = y === currentYear;
                  return (
                    <button
                      type="button"
                      key={y}
                      onClick={() => selectYear(y)}
                      className={`h-8 rounded-lg text-xs font-semibold transition-colors ${
                        isSelected
                          ? 'bg-primary text-white font-bold'
                          : isCurrent
                            ? 'border border-primary text-primary hover:bg-muted'
                            : 'hover:bg-muted text-foreground'
                      }`}
                    >
                      {y}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => selectYear(currentYear)}
                className="mt-2.5 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-muted text-xs font-semibold text-primary transition-colors hover:bg-muted/80"
              >
                <Check size={14} aria-hidden />
                Năm nay ({currentYear})
              </button>
            </div>
          </details>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleNavigateYear(1)}
            aria-label="Năm sau"
            className="size-9 p-0 rounded-xl"
          >
            <ChevronRight size={18} />
          </Button>
        </div>
      </div>

      {/* 3 Summary Total Cards for the Year */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Tổng công năm {selectedYear}
            </span>
            <Wallet className="size-4 text-primary" />
          </div>
          <p className="text-2xl font-black text-foreground sm:text-3xl">
            {vnd(totalEarnedYear)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {totalRecordsYear} lượt ghi nhận sản phẩm
          </p>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Đã nhận đủ</span>
            <CheckCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 sm:text-3xl">
            {vnd(totalReceivedYear)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {totalEarnedYear > 0n
              ? `${percentYear}% tổng tiền công`
              : 'Chưa phát sinh'}
          </p>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Còn lại chưa nhận</span>
            <Clock className="size-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p
            className={`text-2xl font-black sm:text-3xl ${
              totalRemainingYear > 0n
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-muted-foreground'
            }`}
          >
            {vnd(totalRemainingYear)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {totalRemainingYear > 0n ? 'Chờ xác nhận khi nhận tiền' : 'Đã tất toán toàn bộ'}
          </p>
        </Card>
      </div>

      {/* MONTHLY WAGE CHART */}
      <Card className="p-4 sm:p-6">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="size-4 text-primary" />
            Tiền công 12 tháng
          </h3>
          <span className="text-xs font-semibold text-muted-foreground">
            Năm {selectedYear}
          </span>
        </div>

        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          ← Cuộn ngang để xem đủ 12 tháng →
        </p>

        {/* Recharts Bar Chart Container */}
        <div className="mt-3 overflow-x-auto -mx-1 px-1">
          <div className="h-64 sm:h-72 min-w-[560px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  className="text-[11px] font-semibold fill-muted-foreground"
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  tickFormatter={formatYAxis}
                  className="text-[11px] font-medium fill-muted-foreground"
                />
                <Tooltip
                  cursor={{ fill: 'var(--color-muted)', opacity: 0.3 }}
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const item = payload[0].payload;
                    return (
                      <div className="rounded-xl border border-border bg-card p-3 shadow-lg text-xs space-y-1.5 min-w-[170px]">
                        <p className="font-bold text-foreground border-b border-border/60 pb-1">
                          {item.fullName}
                        </p>
                        <p className="text-primary font-bold text-sm">
                          Tiền công: {money(item.earned)}
                        </p>
                        <div className="text-[11px] text-muted-foreground space-y-0.5">
                          <p>Đã nhận: <strong className="text-foreground">{money(item.received)}</strong></p>
                          <p>Còn lại: <strong className="text-amber-600 dark:text-amber-400">{money(item.remaining)}</strong></p>
                          <p>{item.records} lượt ghi công</p>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="earned"
                  fill="var(--color-primary)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={38}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>
    </div>
  );
}
