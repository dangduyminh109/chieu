'use client';

import { useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Wallet, BarChart3, ChevronLeft, ChevronRight, Calendar, RotateCcw, X } from 'lucide-react';
import { ManagementMetrics } from '@/components/ui/management';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { WorkerSelect } from '@/components/ui/worker-select';
import { EmptyState } from '@/components/ui/states';
import {
  ManagerWorkerCard,
  calculateTotals,
  cash,
  type WorkerWithPayroll,
} from './manager-worker-card';
import { ManagerProductivityChart } from './manager-productivity-chart';

export function ManagerPayrollDashboard({
  workers,
  month,
  today,
  selectedWorkerId = '',
}: {
  workers: WorkerWithPayroll[];
  month: string;
  today: string;
  selectedWorkerId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialTab = searchParams.get('tab') === 'chart' ? 'chart' : 'wages';
  const [activeTab, setActiveTab] = useState<'wages' | 'chart'>(initialTab);

  const currentMonthStr = today.slice(0, 7);
  const isCurrentMonth = month === currentMonthStr;

  const selected = workers.find((w) => w.id === selectedWorkerId);
  const visible = selected ? [selected] : workers;
  const allTotals = calculateTotals(visible.flatMap((w) => w.logs));

  function navigate(newMonth: string, newWorker?: string) {
    const params = new URLSearchParams();
    params.set('month', newMonth);
    const w = newWorker !== undefined ? newWorker : selectedWorkerId;
    if (w) params.set('worker', w);
    if (activeTab === 'chart') params.set('tab', 'chart');
    router.push(`${pathname}?${params.toString()}`);
  }

  function shiftMonth(offset: number) {
    const date = new Date(`${month}-01T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + offset);
    navigate(date.toISOString().slice(0, 7));
  }

  function handleTabChange(tab: 'wages' | 'chart') {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'chart') {
      params.set('tab', 'chart');
    } else {
      params.delete('tab');
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-5">
      {/* Page Heading & Tabs */}
      <div className="space-y-4">
        <PageHeader
          title="Tiền công"
          description="Tổng hợp tiền công, theo dõi chi trả và sản lượng từng thợ trong cơ sở."
          icon={Wallet}
        />

        {/* Tab Switcher: Bảng thanh toán | Năng suất thợ */}
        <div className="grid grid-cols-2 w-full rounded-2xl bg-muted/60 p-1 border border-border/50 text-sm font-semibold shadow-2xs">
          <button
            type="button"
            onClick={() => handleTabChange('wages')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs sm:text-sm transition-all ${
              activeTab === 'wages'
                ? 'bg-card text-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Wallet size={16} />
            Bảng thanh toán
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('chart')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs sm:text-sm transition-all ${
              activeTab === 'chart'
                ? 'bg-card text-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <BarChart3 size={16} />
            Năng suất thợ
          </button>
        </div>
      </div>

      {/* Month Navigation & Worker Filter Bar */}
      <Card className="p-3 sm:p-4 border border-border/80 shadow-xs space-y-3">
        {/* Month Picker Row */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={month <= '2000-01'}
            onClick={() => shiftMonth(-1)}
            aria-label="Tháng trước"
            className="flex size-9 sm:size-10 items-center justify-center rounded-xl border border-border/70 bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Calendar size={15} />
            </span>
            <span className="text-sm sm:text-base font-bold text-foreground">
              Tháng {month.slice(5)}/{month.slice(0, 4)}
            </span>
            {!isCurrentMonth && (
              <button
                type="button"
                onClick={() => navigate(currentMonthStr)}
                className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground hover:bg-muted/80 transition-colors"
                title="Về tháng hiện tại"
              >
                <RotateCcw size={11} />
                Hiện tại
              </button>
            )}
          </div>

          <button
            type="button"
            disabled={month >= currentMonthStr}
            onClick={() => shiftMonth(1)}
            aria-label="Tháng sau"
            className="flex size-9 sm:size-10 items-center justify-center rounded-xl border border-border/70 bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Worker Filter Dropdown */}
        <div className="flex items-center gap-2 pt-1 border-t border-border/50">
          <div className="min-w-0 flex-1">
            <WorkerSelect
              id="worker-filter-select"
              workers={workers}
              value={selectedWorkerId}
              onValueChange={(val) => navigate(month, val)}
            />
          </div>

          {selectedWorkerId && (
            <button
              type="button"
              onClick={() => navigate(month, '')}
              className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/70 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Xem tất cả thợ"
              aria-label="Xem tất cả thợ"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </Card>

      {/* TAB 1: BẢNG THANH TOÁN (Overview stats, info notice, and worker cards) */}
      {activeTab === 'wages' && (
        <div className="space-y-5">
          <ManagementMetrics
            items={[
              { label: 'Tiền công\ntháng này', value: cash(allTotals.earned) },
              { label: 'Tiền công\ncòn phải trả', value: cash(allTotals.remaining), emphasis: true },
            ]}
          />
          {/* Worker Cards List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold text-muted-foreground">
                {selected
                  ? `Chi tiết công thợ · ${selected.name}`
                  : `Danh sách thợ (${visible.length})`}
              </h2>
            </div>

            {visible.length === 0 ? (
              <Card className="p-8">
                <EmptyState
                  title="Không tìm thấy dữ liệu thợ"
                  description="Không có thợ nào phù hợp với bộ lọc đã chọn trong tháng này."
                />
              </Card>
            ) : selected ? (
              <ManagerWorkerCard worker={selected} month={month} />
            ) : (
              <Card className="!p-2">
                <div className="divide-y divide-border">
                  {visible.map((worker) => {
                    const t = calculateTotals(worker.logs);
                    return (
                      <button
                        key={worker.id}
                        type="button"
                        onClick={() => navigate(month, worker.id)}
                        className="flex min-h-20 w-full flex-wrap items-center justify-between gap-3 rounded-xl px-3 py-4 text-left hover:bg-muted"
                      >
                        <span className="min-w-0">
                          <strong className="block text-sm">{worker.name}</strong>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {worker.logs.length
                              ? `${worker.logs.length} lượt ghi công`
                              : 'Chưa ghi công'}
                          </span>
                        </span>
                        <span className="text-right">
                          <strong className="block text-sm text-primary">
                            {cash(t.remaining)}
                          </strong>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {t.remaining > 0n
                              ? 'Còn phải trả'
                              : t.earned > 0n
                                ? 'Đã thanh toán'
                                : 'Chưa phát sinh'}{' '}
                            ›
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: NĂNG SUẤT THỢ (Productivity Chart & Comparisons) */}
      {activeTab === 'chart' && (
        <ManagerProductivityChart workers={visible} month={month} today={today} />
      )}
    </div>
  );
}
