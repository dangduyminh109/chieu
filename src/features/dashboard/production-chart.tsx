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
          <CartesianGrid vertical={false} stroke="#dae3dc" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            formatter={(value) => [`${value} chiếu`, 'Số lượng xử lý']}
            contentStyle={{ borderRadius: 12, borderColor: '#dae3dc', fontSize: 14 }}
          />
          <Bar
            dataKey="quantity"
            fill="#216149"
            radius={[6, 6, 0, 0]}
            maxBarSize={48}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
