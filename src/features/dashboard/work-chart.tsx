'use client';
import { useState } from 'react';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';

type Worker = {
  id: string;
  name: string;
  logs: { date: string; stage: string; quantity: number; earned: string }[];
};
export function DashboardWorkChart({
  workers,
  month,
  stageCatalog,
}: {
  workers: Worker[];
  month: string;
  stageCatalog: { code: string; name: string }[];
}) {
  const [metric, setMetric] = useState<'quantity' | 'earned'>('quantity');
  const [stage, setStage] = useState('');
  const logs = workers.flatMap((w) => w.logs);
  const stages = Array.from(
    new Set([...stageCatalog.map((s) => s.name), ...logs.map((l) => l.stage)]),
  );
  const selected = stages.includes(stage)
    ? stage
    : (stageCatalog.find((s) => s.code === 'WEAVING')?.name ?? stages[0] ?? '');
  const days = new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0),
  ).getUTCDate();
  const points = Array.from({ length: days }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, '0')}`;
    const matching = logs.filter(
      (l) => l.date === date && (metric === 'earned' || l.stage === selected),
    );
    const value = matching.reduce(
      (sum, l) => sum + (metric === 'earned' ? BigInt(l.earned) : BigInt(l.quantity)),
      0n,
    );
    return { day: i + 1, value: Number(value), exact: value.toLocaleString('vi-VN') };
  });
  return (
    <Card className="min-w-0 space-y-3 !p-4">
      <h2 className="font-bold">
        Biểu đồ công tháng {Number(month.slice(5))}/{month.slice(0, 4)}
      </h2>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        {(['quantity', 'earned'] as const).map((value) => (
          <button
            type="button"
            key={value}
            aria-pressed={metric === value}
            onClick={() => setMetric(value)}
            className={`min-h-9 rounded-lg px-2 text-sm font-semibold ${metric === value ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'}`}
          >
            {value === 'quantity' ? 'Số lượng' : 'Tiền công'}
          </button>
        ))}
      </div>
      {metric === 'quantity' && (
        <>
          <label htmlFor="dashboard-work-stage" className="sr-only">
            Công đoạn
          </label>
          <Select
            id="dashboard-work-stage"
            value={selected}
            onValueChange={setStage}
            disabled={!stages.length}
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
        </>
      )}
      <p className="text-xs text-muted-foreground">
        {metric === 'quantity'
          ? `${selected || 'Sản lượng'} · Chiếc chiếu`
          : 'Tiền công của tất cả công đoạn · Đồng'}{' '}
        · Theo ngày làm
      </p>
      <div
        className="overflow-x-auto"
        role="region"
        aria-label="Biểu đồ công từng ngày"
        tabIndex={0}
      >
        <div className="h-56" style={{ minWidth: Math.max(640, days * 28) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={points} margin={{ top: 10, right: 12, bottom: 6, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="day" interval={0} tick={{ fontSize: 12 }} />
              <YAxis
                allowDecimals={false}
                width={58}
                tick={{ fontSize: 11 }}
                tickFormatter={(value) =>
                  new Intl.NumberFormat('vi-VN', { notation: 'compact' }).format(Number(value))
                }
              />
              <Tooltip
                labelFormatter={(label) =>
                  `Ngày ${label}/${Number(month.slice(5))}/${month.slice(0, 4)}`
                }
                formatter={(_, __, item) => [
                  `${item.payload.exact} ${metric === 'quantity' ? 'chiếc' : 'đ'}`,
                  metric === 'quantity' ? 'Số lượng' : 'Tiền công',
                ]}
                contentStyle={{
                  background: 'var(--card)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              />
              <Bar
                dataKey="value"
                fill="var(--primary)"
                radius={[4, 4, 0, 0]}
                maxBarSize={30}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Vuốt ngang để xem đủ ngày, bấm cột để xem số liệu.
      </p>
    </Card>
  );
}
