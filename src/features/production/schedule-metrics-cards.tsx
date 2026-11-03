'use client';

import { Layers, Coins, CalendarCheck, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { money, number } from '@/lib/utils';
import type { WorkerMonthlySummary } from './data';

export function ScheduleMetricsCards({ summary }: { summary: WorkerMonthlySummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      {/* Total Quantity */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between text-muted-foreground mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Tổng số chiếu</span>
          <Layers className="size-4 text-primary" />
        </div>
        <p className="text-2xl font-black text-foreground sm:text-3xl">
          {number(summary.totalQuantity)}{' '}
          <span className="text-sm font-normal text-muted-foreground">chiếc</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Trong tháng {summary.monthNumber}/{summary.year}
        </p>
      </Card>

      {/* Accumulated Wage */}
      <Card className="p-4 sm:p-5 bg-primary/5 border-primary/20">
        <div className="flex items-center justify-between text-muted-foreground mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            Tiền công tích lũy
          </span>
          <Coins className="size-4 text-primary" />
        </div>
        <p className="text-2xl font-black text-primary sm:text-3xl">
          {money(summary.totalAmount)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Tính theo số lượng chiếu làm được</p>
      </Card>

      {/* Days Worked */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between text-muted-foreground mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Số ngày có làm</span>
          <CalendarCheck className="size-4 text-primary" />
        </div>
        <p className="text-2xl font-black text-foreground sm:text-3xl">
          {summary.workedDaysCount}{' '}
          <span className="text-sm font-normal text-muted-foreground">
            / {summary.days.length} ngày
          </span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Số ngày có làm việc trong tháng</p>
      </Card>

      {/* Daily Average */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between text-muted-foreground mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Bình quân / ngày</span>
          <TrendingUp className="size-4 text-primary" />
        </div>
        <p className="text-2xl font-black text-foreground sm:text-3xl">
          {summary.avgQuantityPerDay}{' '}
          <span className="text-sm font-normal text-muted-foreground">chiếu/ngày</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Năng suất bình quân ngày có làm</p>
      </Card>
    </div>
  );
}
