'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { QuickWorkDialog } from './quick-work-dialog';
import { ScheduleCalendarGrid } from './schedule-calendar-grid';
import { ScheduleMetricsCards } from './schedule-metrics-cards';
import { ScheduleProductivityChart } from './schedule-productivity-chart';
import { MonthPickerModal } from './month-picker-modal';
import type { WorkerMonthlySummary, DaySchedule } from './data';
import type { MatType, Stage, LaborRate, WorkLog } from '@/types/domain';

export function WorkerSchedule({
  summary,
  mats,
  stages,
  rates,
  workerId,
  today,
  recentLogs = [],
}: {
  summary: WorkerMonthlySummary;
  mats: MatType[];
  stages: Stage[];
  rates: LaborRate[];
  workerId: string;
  today: string;
  recentLogs?: WorkLog[];
}) {
  const router = useRouter();

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(today);

  // Month Picker Popup State
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);

  function handleChooseMonth(year: number, monthNum: number) {
    const nextMonthStr = `${year}-${String(monthNum).padStart(2, '0')}`;
    const params = new URLSearchParams(window.location.search);
    params.set('month', nextMonthStr);
    router.push(`?${params.toString()}`);
    setMonthPickerOpen(false);
  }

  function handleResetToCurrentMonth() {
    const params = new URLSearchParams(window.location.search);
    params.delete('month');
    router.push(`?${params.toString()}`);
    setMonthPickerOpen(false);
  }

  function navigateMonth(deltaMonths: number) {
    const curYear = summary.year;
    const curMonth = summary.monthNumber;
    let nextMonth = curMonth + deltaMonths;
    let nextYear = curYear;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    } else if (nextMonth < 1) {
      nextMonth = 12;
      nextYear -= 1;
    }
    const nextMonthStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
    const params = new URLSearchParams(window.location.search);
    params.set('month', nextMonthStr);
    router.push(`?${params.toString()}`);
  }

  function handleSelectDay(day: DaySchedule) {
    if (day.date > today) return;
    setSelectedDate(day.date);
    setDialogOpen(true);
  }

  function handleOpenQuickWork(date: string) {
    setSelectedDate(date);
    setDialogOpen(true);
  }

  const selectedScheduleDay =
    (selectedDate <= today ? summary.days.find((d) => d.date === selectedDate) : null) ||
    summary.days.find((d) => d.date === today) ||
    summary.days.filter((d) => d.date <= today).at(-1) ||
    summary.days[0];

  return (
    <div className="space-y-6">
      {/* 1. Monthly Calendar Grid & Selected Day Info */}
      <ScheduleCalendarGrid
        summary={summary}
        today={today}
        selectedDate={selectedDate}
        onSelectDay={handleSelectDay}
        onOpenQuickWork={handleOpenQuickWork}
        onNavigateMonth={navigateMonth}
        onOpenMonthPicker={() => setMonthPickerOpen(true)}
      />

      {/* 2. Monthly Summary Metrics Cards */}
      <ScheduleMetricsCards summary={summary} />

      {/* 3. Productivity Chart (Week / Month / Year) */}
      <ScheduleProductivityChart
        stageName={summary.stageName}
        stageId={summary.stageId}
        month={summary.month}
        today={today}
      />

      {/* 4. Quick Work Dialog Modal */}
      <QuickWorkDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mats={mats}
        stages={stages}
        rates={rates}
        workerId={workerId}
        today={today}
        recentMatId={summary.recentMatId}
        existingLogs={recentLogs}
        initialDate={selectedDate}
        initialStageId={summary.stageId}
        initialQuantity={selectedScheduleDay?.quantity || 1}
      />

      {/* 5. Month Picker Modal */}
      <MonthPickerModal
        open={monthPickerOpen}
        onClose={() => setMonthPickerOpen(false)}
        currentYear={summary.year}
        currentMonth={summary.monthNumber}
        today={today}
        onSelectMonth={handleChooseMonth}
        onResetToCurrentMonth={handleResetToCurrentMonth}
      />
    </div>
  );
}
