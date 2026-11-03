export function decimalMilli(value: string): bigint | null {
  if (
    !/^(0|[1-9]\d{0,6})(\.\d{1,3})?$/.test(value) ||
    Number(value) <= 0 ||
    Number(value) > 1000000
  )
    return null;
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, '0'));
}
