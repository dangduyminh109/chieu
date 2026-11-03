import type { LaborRate, Role } from '@/types/domain';
export function calculateWage(quantity: number, unitRate: number) {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1_000_000)
    throw new Error('INVALID_QUANTITY');
  if (!Number.isSafeInteger(unitRate) || unitRate < 0 || unitRate > 1_000_000_000)
    throw new Error('INVALID_RATE');
  const result = quantity * unitRate;
  if (!Number.isSafeInteger(result)) throw new Error('AMOUNT_OVERFLOW');
  return result;
}
export function selectLaborRate(
  rates: LaborRate[],
  matId: string | null,
  stageId: string,
  workerId: string,
  date: string,
) {
  return rates
    .filter(
      (r) =>
        (r.mat_type_id ?? null) === matId &&
        r.stage_id === stageId &&
        r.effective_from <= date &&
        (r.worker_id === null || r.worker_id === workerId),
    )
    .sort(
      (a, b) =>
        Number(b.worker_id !== null) - Number(a.worker_id !== null) ||
        b.effective_from.localeCompare(a.effective_from) ||
        (b.created_at ?? '').localeCompare(a.created_at ?? '') ||
        b.id.localeCompare(a.id),
    )[0];
}
export function hasZeroWage(roles: Role[], enabled: boolean) {
  return enabled && roles.includes('OWNER') && roles.includes('WORKER');
}
