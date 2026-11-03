'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Sparkles, ChevronRight, Layers, Coins, Plus, Pencil, BarChart3 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { money, number, displayDate } from '@/lib/utils';
import { QuickWorkDialog } from './quick-work-dialog';
import type { WorkerMonthlySummary } from './data';
import type { MatType, Stage, LaborRate, WorkLog } from '@/types/domain';

export function WorkerTodayView({
  summary,
  mats,
  stages,
  rates,
  workerId,
  today,
  recentLogs = [],
  workerName,
}: {
  summary: WorkerMonthlySummary;
  mats: MatType[];
  stages: Stage[];
  rates: LaborRate[];
  workerId: string;
  today: string;
  recentLogs?: WorkLog[];
  workerName: string;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);

  // Find today's schedule slot
  const todaySchedule =
    summary.days.find((d) => d.date === today) || summary.days.find((d) => d.isToday);

  const todayQuantity = todaySchedule?.quantity || 0;
  const todayAmount = todaySchedule?.totalAmount || 0;
  const todayLogs = todaySchedule?.logs || [];
  const hasWorkToday = todayQuantity > 0;

  // Calculate this week's total from summary.days
  const todayDateObj = new Date(today);
  const currentWeekDays = summary.days.filter((d) => {
    const dDate = new Date(d.date);
    const diffTime = dDate.getTime() - todayDateObj.getTime();
    const diffDays = Math.round(diffTime / (1000 * 3600 * 24));
    const todayDayOfWeek = todaySchedule ? todaySchedule.dayOfWeek : 0; // 0=Mon, 6=Sun
    return diffDays >= -todayDayOfWeek && diffDays <= 6 - todayDayOfWeek;
  });
  const weekQuantity = currentWeekDays.reduce((sum, d) => sum + d.quantity, 0);
  const weekAmount = currentWeekDays.reduce((sum, d) => sum + d.totalAmount, 0);

  // Helper to resolve mat type name
  const matMap = new Map(mats.map((m) => [m.id, m.name]));

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* 1. GREETING & DATE HEADER (Clean, no redundant buttons) */}
      <div className="space-y-0.5">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-wider">
          <Sparkles className="size-3.5" />
          {summary.stageName}
        </div>
        <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
          Chào {workerName.split(' ').at(-1) || 'bạn'},
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Hôm nay là <span className="font-semibold text-foreground">{displayDate(today)}</span>
        </p>
      </div>

      {/* 2. TODAY HERO CARD (TRỌNG TÂM NGÀY HIỆN TẠI) */}
      <Card
        className={`relative overflow-hidden p-4 sm:p-5 transition-all ${
          hasWorkToday
            ? 'border-primary/40 bg-gradient-to-br from-primary/10 via-card to-card ring-1 ring-primary/20'
            : 'border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-card to-card'
        }`}
      >
        {/* Card Header: Date & Title */}
        <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-3">
          <span className="text-xs font-bold text-primary flex items-center gap-1.5">
            <Sparkles size={14} /> Hôm nay
          </span>
          <span className="text-xs font-medium text-muted-foreground">{displayDate(today)}</span>
        </div>

        {/* Message and action */}
        <div className="mt-3 space-y-1.5">
          <h2 className="text-base sm:text-lg font-bold text-foreground">
            {hasWorkToday
              ? `Đã làm ${number(todayQuantity)} chiếc chiếu hôm nay`
              : 'Chưa có bản ghi chiếu hôm nay'}
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {hasWorkToday
              ? 'Sản phẩm hôm nay đã được ghi nhận vào hệ thống để tích lũy tiền công.'
              : 'Bấm nút bên dưới để nhập số lượng chiếu làm được hôm nay.'}
          </p>

          <Button
            onClick={() => setDialogOpen(true)}
            variant={hasWorkToday ? 'outline' : 'default'}
            className="mt-2 w-full font-bold justify-center"
          >
            {hasWorkToday ? <Pencil size={15} /> : <Plus size={15} />}
            <span>{hasWorkToday ? 'Chỉnh sửa số lượng' : 'Nhập số lượng ngay'}</span>
          </Button>
        </div>

        {/* Big Today Stats Highlight: SỐ CHIẾU - TIỀN CÔNG (NO WRAP) */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-4">
          <div className="rounded-xl bg-card p-3 border border-border">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">Số chiếu</span>
              <Layers className="size-4 text-primary shrink-0" />
            </div>
            <p className="mt-1 text-xl sm:text-2xl font-black text-foreground">
              {number(todayQuantity)}{' '}
              <span className="text-xs font-normal text-muted-foreground">chiếc</span>
            </p>
          </div>

          <div className="rounded-xl bg-primary/10 p-3 border border-primary/20">
            <div className="flex items-center justify-between text-primary">
              <span className="text-xs font-semibold uppercase tracking-wider">Tiền công</span>
              <Coins className="size-4 text-primary shrink-0" />
            </div>
            <p className="mt-1 text-xl sm:text-2xl font-black text-primary truncate">
              {money(todayAmount)}
            </p>
          </div>
        </div>

        {/* Breakdown of Today's Logs with valid rate (NO NaN) */}
        {todayLogs.length > 0 && (
          <div className="mt-3 space-y-2 rounded-xl bg-muted/40 p-3 border border-border/40">
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Chi tiết bản ghi hôm nay ({todayLogs.length} lần ghi)
            </div>
            <div className="divide-y divide-border/40">
              {todayLogs.map((log) => {
                const effectiveRate = Number(
                  log.unit_rate ?? (log.quantity > 0 ? Number(log.total_amount) / log.quantity : 0),
                );

                return (
                  <div key={log.id} className="flex items-center justify-between py-2 text-xs">
                    <div className="min-w-0 pr-2">
                      <p className="font-semibold text-foreground truncate">
                        {matMap.get(log.stock_mat_type_id ?? log.mat_type_id ?? '') || 'Chiếu'}
                      </p>
                      <p className="text-muted-foreground text-[11px]">
                        {number(log.quantity)} chiếc × {money(effectiveRate)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-primary">{money(Number(log.total_amount))}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* 3. ACCUMULATED PROGRESS CARD (Tuần này - Cả tháng, rộng rãi không bị chật) */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          <span>Tiến độ tích lũy</span>
          <span className="text-[11px] font-normal normal-case text-muted-foreground">
            Tháng {summary.monthNumber}/{summary.year}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 divide-x divide-border/60">
          <div className="pr-2">
            <span className="text-xs font-semibold text-muted-foreground block">Tuần này</span>
            <p className="mt-1 text-lg sm:text-2xl font-black text-primary truncate tracking-tight">
              {money(weekAmount)}
            </p>
            <p className="text-xs font-bold text-foreground mt-0.5">
              {number(weekQuantity)}{' '}
              <span className="text-muted-foreground font-normal">chiếc</span>
            </p>
          </div>
          <div className="pl-4">
            <span className="text-xs font-semibold text-muted-foreground block">
              Cả tháng {summary.monthNumber}
            </span>
            <p className="mt-1 text-lg sm:text-2xl font-black text-primary truncate tracking-tight">
              {money(summary.totalAmount)}
            </p>
            <p className="text-xs font-bold text-foreground mt-0.5">
              {number(summary.totalQuantity)}{' '}
              <span className="text-muted-foreground font-normal">chiếc</span>
            </p>
          </div>
        </div>
      </Card>

      {/* 4. BANNER SHORTCUT TO STATS (/analytics) */}
      <Link
        href="/analytics"
        className="group flex items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 transition-all hover:border-primary hover:bg-primary/10 active:scale-[0.99]"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-xs">
            <BarChart3 className="size-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
              Xem biểu đồ & Thống kê sản lượng
            </h3>
            <p className="text-xs text-muted-foreground truncate">
              Thống kê số lượng chiếu theo Tuần, Tháng, Năm
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 text-xs font-bold text-primary">
          <ChevronRight size={18} className="transition-transform group-hover:translate-x-0.5" />
        </div>
      </Link>

      {/* 5. RECENT WORK LOGS (GẦN ĐÂY) */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-foreground">Tiền công gần đây</h3>
            <p className="text-xs text-muted-foreground">Các lần ghi nhận tiền công mới nhất</p>
          </div>
          <Link
            href="/wages"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            Bảng lương <ChevronRight size={14} />
          </Link>
        </div>

        <div className="mt-2 divide-y divide-border/60">
          {recentLogs.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              Chưa có bản ghi nào.
            </div>
          ) : (
            recentLogs.slice(0, 4).map((log) => {
              const isLogToday = log.work_date === today;

              return (
                <div key={log.id} className="flex items-center justify-between py-2.5 text-xs">
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">
                        {number(log.quantity)} chiếu
                      </span>
                      {isLogToday && (
                        <span className="rounded-full bg-primary/20 px-1.5 py-0.2 text-[10px] font-bold text-primary">
                          Hôm nay
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {(() => {
                        const st = stages.find((s) => s.id === log.stage_id);
                        const isWeave = st?.code === 'WEAVING';
                        const mName =
                          matMap.get(log.stock_mat_type_id ?? log.mat_type_id ?? '') || 'Chiếu';
                        const stageTitle = isWeave
                          ? `${st?.name || 'Dệt chiếu'} • ${mName}`
                          : st?.name || 'Sản xuất';
                        return `${stageTitle} • ${displayDate(log.work_date)}`;
                      })()}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="font-bold text-foreground">{money(Number(log.total_amount))}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* QUICK WORK LOG DIALOG FOR TODAY */}
      <QuickWorkDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mats={mats}
        stages={stages}
        rates={rates}
        workerId={workerId}
        today={today}
        initialDate={today}
        initialStageId={todayLogs[0]?.stage_id || summary.stageId}
        initialMatId={
          todayLogs[0]?.stock_mat_type_id || todayLogs[0]?.mat_type_id || summary.recentMatId
        }
        initialQuantity={todayLogs[0]?.quantity || (todayQuantity > 0 ? todayQuantity : 1)}
        existingLogs={[...todayLogs, ...summary.days.flatMap((d) => d.logs), ...recentLogs]}
      />
    </div>
  );
}
