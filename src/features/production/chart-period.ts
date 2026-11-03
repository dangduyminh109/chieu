export type ChartPeriod = 'week' | 'month' | 'year';
export function chartRange(anchor: string, period: ChartPeriod) {
  const date = new Date(`${anchor}T12:00:00Z`);
  const start = new Date(date);
  const end = new Date(date);
  if (period === 'week') {
    start.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    end.setTime(start.getTime());
    end.setUTCDate(start.getUTCDate() + 6);
  }
  if (period === 'month') {
    start.setUTCDate(1);
    end.setUTCMonth(end.getUTCMonth() + 1, 0);
  }
  if (period === 'year') {
    start.setUTCMonth(0, 1);
    end.setUTCMonth(11, 31);
  }
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
export function shiftChartPeriod(anchor: string, period: ChartPeriod, delta: number) {
  const date = new Date(`${anchor}T12:00:00Z`);
  if (period === 'week') date.setUTCDate(date.getUTCDate() + delta * 7);
  else {
    date.setUTCDate(1);
    if (period === 'month') date.setUTCMonth(date.getUTCMonth() + delta);
    else date.setUTCFullYear(date.getUTCFullYear() + delta);
  }
  return date.toISOString().slice(0, 10);
}
