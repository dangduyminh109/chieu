'use client';

import { useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  CalendarDays,
  BarChart3,
  ListFilter,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  LabelList,
} from 'recharts';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { WorkerSelect } from '@/components/ui/worker-select';
import { Button } from '@/components/ui/button';
import { StageIcon } from '@/features/production/stage-icon';
import { cn } from '@/lib/utils';

type Worker = {
  id: string;
  name: string;
  avatar_path?: string | null;
  logs: { date: string; stage: string; quantity: number }[];
};

export function ManagerProductivityChart({
  workers,
  month,
  today,
  navigateMonths = false,
}: {
  workers: Worker[];
  month: string;
  today: string;
  navigateMonths?: boolean;
}) {
  const [workerId, setWorkerId] = useState('');
  const [stage, setStage] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
  const [onlyWorkedDays, setOnlyWorkedDays] = useState(true);

  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();

  // Keep every standard stage selectable even when this month has no work for it.
  const stages = Array.from(
    new Set([
      'Dệt chiếu',
      'Buộc chiếu',
      'Cắt chiếu',
      'May chiếu',
      'Công việc khác',
      ...workers.flatMap((w) => w.logs.map((l) => l.stage)),
    ]),
  );
  const chosenStage = stages.includes(stage)
    ? stage
    : (stages.find((name) => name.toLocaleLowerCase('vi-VN').includes('dệt')) ?? stages[0] ?? '');
  const chosenWorker = workers.some((w) => w.id === workerId) ? workerId : '';
  const visible = chosenWorker ? workers.filter((w) => w.id === chosenWorker) : workers;

  const logsWithWorker = visible.flatMap((w) =>
    w.logs
      .filter((l) => l.stage === chosenStage)
      .map((l) => ({ ...l, workerId: w.id, workerName: w.name })),
  );

  const daysInMonth = new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0),
  ).getUTCDate();

  const getDayInfo = (dayNum: number) => {
    const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)) - 1, dayNum));
    const dayOfWeekIdx = d.getUTCDay();
    const dayNames = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
    const shortNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    return {
      fullName: dayNames[dayOfWeekIdx],
      shortName: shortNames[dayOfWeekIdx],
      isWeekend: dayOfWeekIdx === 0 || dayOfWeekIdx === 6,
    };
  };

  const points = Array.from({ length: daysInMonth }, (_, index) => {
    const dayNum = index + 1;
    const date = `${month}-${String(dayNum).padStart(2, '0')}`;
    const dayLogs = logsWithWorker.filter((l) => l.date === date);
    const quantity = dayLogs.reduce((sum, l) => sum + l.quantity, 0);
    const dayInfo = getDayInfo(dayNum);
    return {
      name: String(dayNum),
      date,
      dayNum,
      dayInfo,
      quantity,
      logs: dayLogs,
    };
  });

  const comparison = visible
    .map((w) => ({
      id: w.id,
      name: w.name,
      quantity: w.logs
        .filter((l) => l.stage === chosenStage)
        .reduce((sum, l) => sum + l.quantity, 0),
    }))
    .sort((a, b) => b.quantity - a.quantity);

  const total = points.reduce((sum, p) => sum + p.quantity, 0);
  const workedDaysList = points.filter((p) => p.quantity > 0);
  const workDays = workedDaysList.length;

  const displayedPoints = onlyWorkedDays && workedDaysList.length > 0 ? workedDaysList : points;

  function changeMonth(offset: number | null) {
    const date = new Date(`${month}-01T12:00:00Z`);
    if (offset !== null) date.setUTCMonth(date.getUTCMonth() + offset);
    const next = offset === null ? today.slice(0, 7) : date.toISOString().slice(0, 7);
    const query = new URLSearchParams(params.toString());
    query.set('month', next);
    router.push(`${path}?${query.toString()}`, { scroll: false });
  }

  return (
    <Card className="min-w-0 space-y-4">
      <div className="space-y-3">
        <h2 className="text-lg font-bold">Năng suất thợ</h2>
        {/* Toggle between Table (Day by day) and Chart */}
        <div className="grid w-full grid-cols-2 items-center rounded-xl bg-muted/80 p-1 border border-border/60">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={cn(
              'flex min-w-0 items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-semibold transition-all',
              viewMode === 'table'
                ? 'bg-card text-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <CalendarDays size={14} />
            Bảng đối soát ngày
          </button>
          <button
            type="button"
            onClick={() => setViewMode('chart')}
            className={cn(
              'flex min-w-0 items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-semibold transition-all',
              viewMode === 'chart'
                ? 'bg-card text-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <BarChart3 size={14} />
            Biểu đồ
          </button>
        </div>
      </div>

      {navigateMonths && (
        <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] gap-2">
          <Button
            variant="outline"
            className="!px-0"
            onClick={() => changeMonth(-1)}
            disabled={month <= '2000-01'}
            aria-label="Tháng trước"
          >
            <ChevronLeft size={18} />
          </Button>
          <Button
            variant="outline"
            className="min-w-0 !px-2"
            onClick={() => changeMonth(null)}
            aria-label="Về tháng hiện tại"
          >
            <RotateCcw size={15} />
            <span className="truncate">
              Tháng {month.slice(5)}/{month.slice(0, 4)}
            </span>
          </Button>
          <Button
            variant="outline"
            className="!px-0"
            onClick={() => changeMonth(1)}
            disabled={month >= today.slice(0, 7)}
            aria-label="Tháng sau"
          >
            <ChevronRight size={18} />
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0 space-y-2">
          <label htmlFor="chart-worker">Thợ</label>
          <WorkerSelect
            id="chart-worker"
            workers={workers}
            value={chosenWorker}
            onValueChange={setWorkerId}
            allLabel="Tất cả thợ"
          />
        </div>
        <div className="min-w-0 space-y-2">
          <label htmlFor="chart-stage">Công đoạn</label>
          <Select
            id="chart-stage"
            value={chosenStage}
            onValueChange={setStage}
            disabled={!stages.length}
            optionIcons={(val, small) =>
              val ? (
                <StageIcon
                  name={val}
                  size={small ? 28 : 24}
                  className="rounded-md border border-border/70"
                />
              ) : null
            }
          >
            {stages.length ? (
              stages.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))
            ) : (
              <option value="">Chưa có công</option>
            )}
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm bg-muted/40 p-3 rounded-xl border border-border/60">
        <p>
          Tổng sản lượng:{' '}
          <strong className="text-primary text-base">{total.toLocaleString('vi-VN')} chiếc</strong>
        </p>
        <p>
          Số ngày có công: <strong>{workDays} ngày</strong>
        </p>
        <p>
          Bình quân ngày làm:{' '}
          <strong>
            {workDays
              ? (total / workDays).toLocaleString('vi-VN', { maximumFractionDigits: 1 })
              : 0}{' '}
            chiếc
          </strong>
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        {chosenStage || 'Năng suất'} · Tháng {month.slice(5)}/{month.slice(0, 4)} · Đơn vị: chiếc
        chiếu
      </p>

      {!logsWithWorker.length ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Chưa có công trong tháng đã chọn.
        </p>
      ) : (
        <>
          {/* VIEW 1: BẢNG ĐỐI SOÁT TỪNG NGÀY */}
          {viewMode === 'table' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-semibold text-muted-foreground">
                  {onlyWorkedDays
                    ? `Danh sách ${workDays} ngày có công`
                    : `Toàn bộ ${daysInMonth} ngày trong tháng`}
                </span>
                <button
                  type="button"
                  onClick={() => setOnlyWorkedDays(!onlyWorkedDays)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  <ListFilter size={13} />
                  {onlyWorkedDays
                    ? `Xem toàn bộ ${daysInMonth} ngày`
                    : `Chỉ hiện ngày có công (${workDays})`}
                </button>
              </div>

              <div className="divide-y divide-border/60 rounded-xl border border-border/80 bg-surface overflow-hidden shadow-2xs">
                {displayedPoints.map((p) => {
                  const isToday = p.date === today;
                  const hasWork = p.quantity > 0;
                  return (
                    <div
                      key={p.date}
                      className={cn(
                        'flex items-center justify-between gap-3 px-3.5 py-2.5 transition-colors',
                        hasWork
                          ? 'bg-card hover:bg-muted/50'
                          : 'bg-muted/20 opacity-60 hover:bg-muted/40',
                        isToday && 'ring-1 ring-inset ring-primary/40',
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={cn(
                            'flex flex-col items-center justify-center size-9 sm:size-10 rounded-xl shrink-0 font-bold border transition-colors',
                            hasWork
                              ? 'bg-primary text-white border-primary shadow-2xs'
                              : 'bg-muted text-muted-foreground border-border/70',
                          )}
                        >
                          <span className="text-[10px] uppercase font-semibold leading-none">
                            {p.dayInfo.shortName}
                          </span>
                          <span className="text-sm sm:text-base font-black leading-none mt-0.5">
                            {p.dayNum}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-xs sm:text-sm text-foreground">
                              {p.dayInfo.fullName}, {String(p.dayNum).padStart(2, '0')}/
                              {month.slice(5)}/{month.slice(0, 4)}
                            </span>
                            {isToday && (
                              <span className="rounded-md bg-primary/15 px-1.5 py-0.2 text-[10px] font-bold text-primary">
                                Hôm nay
                              </span>
                            )}
                          </div>
                          {hasWork && !chosenWorker && p.logs.length > 0 && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {p.logs.map((l) => `${l.workerName}: ${l.quantity}c`).join(' · ')}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        {hasWork ? (
                          <div className="flex items-baseline justify-end gap-1">
                            <span className="text-base sm:text-lg font-black text-primary tracking-tight">
                              {p.quantity.toLocaleString('vi-VN')}
                            </span>
                            <span className="text-xs font-semibold text-muted-foreground">
                              chiếc
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/60 italic">0 chiếc</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* VIEW 2: BIỂU ĐỒ CỘT (kèm số lượng trực tiếp trên từng cột) */
            <div className="space-y-3">
              <div
                className="overflow-x-auto"
                role="region"
                aria-label="Năng suất theo từng ngày"
                tabIndex={0}
              >
                <div className="h-64" style={{ minWidth: Math.max(640, daysInMonth * 28) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={points} margin={{ top: 20, right: 12, left: 0, bottom: 8 }}>
                      <CartesianGrid
                        vertical={false}
                        stroke="var(--border-warm, #2e3d34)"
                        strokeDasharray="3 3"
                      />
                      <XAxis
                        dataKey="name"
                        interval={0}
                        tick={{ fontSize: 11, fill: 'var(--text-secondary, #8fa898)' }}
                        tickLine={false}
                        axisLine={{ stroke: 'var(--border-warm, #2e3d34)' }}
                      />
                      <YAxis
                        allowDecimals={false}
                        width={40}
                        tick={{ fontSize: 11, fill: 'var(--text-secondary, #8fa898)' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        cursor={{
                          fill: 'var(--craft-green-soft, rgba(77, 184, 140, 0.15))',
                          opacity: 0.5,
                        }}
                        content={({ active, payload, label }) => {
                          if (!active || !payload || !payload.length) return null;
                          return (
                            <div className="rounded-xl border border-border bg-card p-2.5 shadow-lg text-xs space-y-1">
                              <p className="font-bold text-foreground">
                                Ngày {label}/{month.slice(5)}/{month.slice(0, 4)}
                              </p>
                              <p className="text-primary font-bold text-sm">
                                {Number(payload[0].value).toLocaleString('vi-VN')} chiếc
                              </p>
                            </div>
                          );
                        }}
                      />
                      <Bar
                        dataKey="quantity"
                        fill="var(--craft-green, #4db88c)"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={32}
                        isAnimationActive={false}
                      >
                        <LabelList
                          dataKey="quantity"
                          position="top"
                          offset={4}
                          formatter={(val: unknown) =>
                            Number(val) > 0 ? Number(val).toLocaleString('vi-VN') : ''
                          }
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            fill: 'var(--text-primary)',
                          }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Số lượng được hiển thị trực tiếp trên đầu mỗi cột. Vuốt ngang để xem đủ các ngày.
              </p>
            </div>
          )}

          {comparison.length > 1 && (
            <div className="space-y-3 pt-3 border-t border-border/70">
              <h3 className="text-sm font-semibold">Sản lượng từng thợ · {chosenStage}</h3>
              {comparison.map((w) => (
                <div key={w.id} className="space-y-1">
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="min-w-0 break-words">{w.name}</span>
                    <strong className="shrink-0">{w.quantity.toLocaleString('vi-VN')} chiếc</strong>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${comparison[0].quantity ? (w.quantity / comparison[0].quantity) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
