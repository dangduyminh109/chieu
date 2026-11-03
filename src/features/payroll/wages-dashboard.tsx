'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Wallet, BarChart3, CalendarDays } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { WagesHeroCard } from './wages-hero-card';
import { WagesHistoryList } from './wages-history-list';
import { WagesYearlyChart } from './wages-yearly-chart';
import type { WageMonth } from './types';

export type { WageMonth };

export function WagesDashboard({
  historyMonths,
  recent12Months = [],
  selectedYearMonths,
  currentYear,
  selectedYear,
  currentDate,
}: {
  historyMonths?: WageMonth[];
  recent12Months?: WageMonth[];
  selectedYearMonths: WageMonth[];
  currentYear: number;
  selectedYear: number;
  currentDate: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Active Tab: 'month' (Bảng lương & lịch sử) | 'year' (Thống kê theo năm)
  const initialTab = searchParams.get('tab') === 'year' ? 'year' : 'month';
  const [activeTab, setActiveTab] = useState<'month' | 'year'>(initialTab);

  function handleTabChange(tab: 'month' | 'year') {
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    params.set('tab', tab);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  const allHistory = historyMonths ?? recent12Months;
  const currentMonthStr = currentDate.slice(0, 7);
  const currentMonth = allHistory.find((m) => m.month === currentMonthStr);

  return (
    <div className="space-y-6">
      {/* Page Heading & Main Tab Switcher */}
      <div className="space-y-4">
        <PageHeader
          title="Tiền công"
          description="Theo dõi tiến độ chi trả hàng tháng và thống kê năm."
          icon={Wallet}
        />

        {/* Top Two Tabs: Full Width */}
        <div className="grid grid-cols-2 w-full rounded-2xl bg-muted/60 p-1 border border-border/50 text-sm font-semibold shadow-2xs">
          <button
            type="button"
            onClick={() => handleTabChange('month')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs sm:text-sm transition-all ${
              activeTab === 'month'
                ? 'bg-card text-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <CalendarDays size={16} />
            Bảng lương
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('year')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs sm:text-sm transition-all ${
              activeTab === 'year'
                ? 'bg-card text-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <BarChart3 size={16} />
            Thống kê
          </button>
        </div>
      </div>

      {/* TAB 1: Bảng lương (Tháng hiện tại & Lịch sử các tháng) */}
      {activeTab === 'month' && (
        <div className="space-y-6">
          <WagesHeroCard currentMonth={currentMonth} currentDate={currentDate} />
          <WagesHistoryList historyMonths={allHistory} currentMonthStr={currentMonthStr} />
        </div>
      )}

      {/* TAB 2: Thống kê (Tổng hợp & Biểu đồ 12 tháng theo năm) */}
      {activeTab === 'year' && (
        <WagesYearlyChart
          selectedYearMonths={selectedYearMonths}
          currentYear={currentYear}
          selectedYear={selectedYear}
        />
      )}
    </div>
  );
}
