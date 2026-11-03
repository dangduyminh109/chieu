'use client';

import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar as CalendarIcon,
  Plus,
  Pencil,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { money, number, displayDate } from '@/lib/utils';
import type { WorkerMonthlySummary, DaySchedule } from './data';

export function ScheduleCalendarGrid({
  summary,
  today,
  selectedDate,
  onSelectDay,
  onOpenQuickWork,
  onNavigateMonth,
  onOpenMonthPicker,
}: {
  summary: WorkerMonthlySummary;
  today: string;
  selectedDate: string;
  onSelectDay: (day: DaySchedule) => void;
  onOpenQuickWork: (date: string) => void;
  onNavigateMonth: (delta: number) => void;
  onOpenMonthPicker: () => void;
}) {
  const selectedScheduleDay =
    (selectedDate <= today ? summary.days.find((d) => d.date === selectedDate) : null) ||
    summary.days.find((d) => d.date === today) ||
    summary.days.filter((d) => d.date <= today).at(-1) ||
    summary.days[0];

  return (
    <Card className="overflow-hidden p-3 sm:p-5">
      {/* Month Selector Header */}
      <div className="mb-3 flex items-center justify-between sm:justify-start gap-1.5 sm:gap-2 border-b border-border/60 pb-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigateMonth(-1)}
          aria-label="Tháng trước"
          className="size-9 !p-0 rounded-xl border-border hover:bg-muted active:scale-95 shrink-0 flex items-center justify-center"
        >
          <ChevronLeft size={22} className="stroke-[2.5] shrink-0" />
        </Button>

        {/* Clickable Month Label with dropdown indicator -> Opens Month Picker Popup */}
        <button
          type="button"
          onClick={onOpenMonthPicker}
          className="flex items-center gap-1.5 px-3 py-1.5 h-9 rounded-xl border border-border/80 bg-card hover:bg-muted/80 text-xs sm:text-sm font-bold text-foreground whitespace-nowrap active:scale-95 transition-all shadow-2xs cursor-pointer shrink-0"
          aria-label="Mở bảng chọn tháng"
          title="Nhấn để chọn tháng"
        >
          <CalendarIcon size={16} className="text-primary shrink-0" />
          <span>
            Tháng {summary.monthNumber}/{summary.year}
          </span>
          <ChevronDown size={14} className="text-muted-foreground shrink-0" />
        </button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigateMonth(1)}
          disabled={summary.month >= today.slice(0, 7)}
          aria-label="Tháng sau"
          className="size-9 !p-0 rounded-xl border-border hover:bg-muted active:scale-95 shrink-0 flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronRight size={22} className="stroke-[2.5] shrink-0" />
        </Button>
      </div>

      {/* 7-day Column Headers */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-xs font-bold text-muted-foreground mb-1.5">
        {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((h, i) => (
          <div key={h} className={i >= 5 ? 'text-amber-600 dark:text-amber-400' : ''}>
            {h}
          </div>
        ))}
      </div>

      {/* Calendar Day Slots Grid */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2 auto-rows-[68px] sm:auto-rows-[84px]">
        {/* Empty padding slots before the 1st */}
        {Array.from({ length: summary.paddingDaysStart }).map((_, i) => (
          <div
            key={`pad-${i}`}
            className="h-[68px] sm:h-[84px] rounded-lg sm:rounded-xl bg-muted/20 opacity-30"
          />
        ))}

        {/* Actual days in month */}
        {summary.days.map((day) => {
          const hasWork = day.quantity > 0;
          const isSelected = selectedDate === day.date;
          const isFuture = day.date > today;

          return (
            <button
              key={day.date}
              type="button"
              disabled={isFuture}
              onClick={() => onSelectDay(day)}
              className={`group relative flex flex-col justify-between rounded-lg sm:rounded-xl p-1 sm:p-2 text-left transition-all h-[68px] sm:h-[84px] border ${
                isFuture
                  ? 'border-border/30 bg-muted/15 opacity-30 cursor-not-allowed pointer-events-none'
                  : isSelected
                    ? 'border-primary ring-2 ring-primary bg-primary/10 shadow-xs'
                    : day.isToday
                      ? 'border-primary/80 ring-1 ring-primary/40 bg-primary/5'
                      : hasWork
                        ? 'border-primary/40 bg-primary/5 hover:border-primary/70'
                        : 'border-border/60 bg-surface/50 hover:bg-muted/40 hover:border-border'
              }`}
            >
              {/* Day Header */}
              <div className="flex items-center justify-between w-full">
                <span
                  className={`text-[11px] sm:text-xs font-bold leading-none ${
                    day.isToday ? 'text-primary font-black' : 'text-foreground/80'
                  }`}
                >
                  {day.dayNumber}
                </span>

                {day.isToday && (
                  <span className="hidden sm:inline text-[9px] font-bold text-primary uppercase">
                    Hôm nay
                  </span>
                )}
              </div>

              {/* Day Content: Clean Quantity Badge */}
              {hasWork ? (
                <div className="mt-auto w-full flex flex-col items-center justify-center pb-0.5">
                  <span className="inline-flex items-center justify-center min-w-[28px] h-5 sm:h-6 px-1.5 rounded-md text-[11px] sm:text-xs font-black text-white shadow-2xs bg-primary">
                    {day.quantity}
                  </span>
                  <span className="hidden sm:inline text-[9px] font-medium text-muted-foreground mt-0.5 truncate">
                    {money(day.totalAmount)}
                  </span>
                </div>
              ) : (
                <div className="mt-auto opacity-0 group-hover:opacity-100 transition-opacity flex justify-end">
                  <span className="hidden sm:flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Plus size={12} />
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* SELECTED DAY SUMMARY CARD */}
      {selectedScheduleDay && (
        <div className="mt-3 rounded-xl border border-border/80 bg-muted/40 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-card border border-border font-bold text-xs text-primary shadow-xs">
                {selectedScheduleDay.dayNumber}
              </span>
              <span className="font-bold text-xs sm:text-sm text-foreground truncate">
                {selectedScheduleDay.dayLabel}, {displayDate(selectedScheduleDay.date)}
              </span>
              {selectedScheduleDay.date === today && (
                <span className="shrink-0 rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
                  Hôm nay
                </span>
              )}
            </div>

            {selectedScheduleDay.date <= today && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenQuickWork(selectedScheduleDay.date)}
                className="shrink-0 !h-6 !min-h-6 !px-2 !py-0 gap-1 !text-[11px] font-medium rounded-md border-border/80 text-foreground hover:bg-muted hover:border-primary/40 active:scale-95 transition-all shadow-none"
              >
                {selectedScheduleDay.quantity > 0 ? (
                  <Pencil size={10} className="stroke-[2.2] text-muted-foreground" />
                ) : (
                  <Plus size={10} className="stroke-[2.2] text-muted-foreground" />
                )}
                <span>{selectedScheduleDay.quantity > 0 ? 'Sửa' : 'Nhập'}</span>
              </Button>
            )}
          </div>

          <div className="pt-2 flex items-center justify-between gap-2 text-xs">
            {selectedScheduleDay.quantity > 0 ? (
              <div className="flex items-center gap-2 text-muted-foreground flex-wrap">
                <span>
                  Đã làm:{' '}
                  <strong className="text-foreground">
                    {number(selectedScheduleDay.quantity)} chiếc
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Tiền công:{' '}
                  <strong className="text-primary font-bold">
                    {money(selectedScheduleDay.totalAmount)}
                  </strong>
                </span>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Chưa có số lượng ghi nhận trong ngày này
              </p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
