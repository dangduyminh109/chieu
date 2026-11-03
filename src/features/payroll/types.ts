export type WageMonth = {
  month: string;
  earned: string;
  received: string;
  remaining: string;
  records: number;
  last_received_at: string | null;
};

export const vnd = (amount: string | bigint | number) => {
  const num =
    typeof amount === 'number'
      ? BigInt(Math.round(amount))
      : typeof amount === 'string'
        ? BigInt(amount || '0')
        : amount;
  return `${num.toLocaleString('vi-VN')} đ`;
};

export function formatYAxis(value: number) {
  if (value === 0) return '0';
  if (value >= 1_000_000) {
    const tr = value / 1_000_000;
    return `${tr % 1 === 0 ? tr.toFixed(0) : tr.toFixed(1)} tr`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(0)} k`;
  }
  return String(value);
}
