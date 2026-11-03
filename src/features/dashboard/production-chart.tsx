'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export function ProductionChart({ data }: { data: { name: string; quantity: number }[] }) {
  return (
    <div
      className="mt-6 h-64 w-full"
      role="img"
      aria-label={data.map((d) => `${d.name}: ${d.quantity} chiếu`).join(', ')}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
          <CartesianGrid vertical={false} stroke="var(--border-warm, #cfcbc0)" strokeDasharray="3 3" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: 'var(--text-secondary, #4a5a50)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 12, fill: 'var(--text-secondary, #4a5a50)' }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            formatter={(value) => [`${value} chiếc`, 'Số lượng xử lý']}
            contentStyle={{
              borderRadius: 12,
              background: 'var(--surface, #ffffff)',
              borderColor: 'var(--border-warm, #cfcbc0)',
              color: 'var(--text-primary, #26332b)',
              fontSize: 14,
            }}
          />
          <Bar
            dataKey="quantity"
            fill="var(--craft-green, #4db88c)"
            radius={[6, 6, 0, 0]}
            maxBarSize={48}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
