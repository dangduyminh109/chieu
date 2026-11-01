import { describe, it, expect } from 'vitest';
import { calculateWage, selectLaborRate, hasZeroWage } from '@/features/production/calculations';
import { can, canReadWork } from '@/lib/permissions';
import { businessDate } from '@/lib/utils';
import { workSchema } from '@/features/production/schemas';
import type { LaborRate } from '@/types/domain';
const base: LaborRate = {
  id: 'a',
  mat_type_id: 'mat',
  stage_id: 'weave',
  worker_id: null,
  effective_from: '2026-01-01',
  unit_rate: 8000,
};
describe('wages and historical rates', () => {
  it('calculates integer VND including zero', () => {
    expect(calculateWage(10, 8000)).toBe(80000);
    expect(calculateWage(10, 0)).toBe(0);
  });
  it.each([0, -1, 1.5, NaN, Infinity, 1000001])('rejects invalid quantity %s', (q) =>
    expect(() => calculateWage(q, 8000)).toThrow(),
  );
  it.each([-1, 0.5, 1000000001, NaN])('rejects invalid rate %s', (r) =>
    expect(() => calculateWage(1, r)).toThrow(),
  );
  it('selects latest effective rate without future leakage', () => {
    const rates = [base, { ...base, id: 'b', effective_from: '2026-11-01', unit_rate: 12000 }];
    expect(selectLaborRate(rates, 'mat', 'weave', 'worker', '2026-10-31')?.unit_rate).toBe(8000);
    expect(selectLaborRate(rates, 'mat', 'weave', 'worker', '2026-11-02')?.unit_rate).toBe(12000);
    expect(selectLaborRate(rates, 'mat', 'weave', 'worker', '2025-12-31')).toBeUndefined();
  });
  it('prioritizes own arrangement and excludes other workers', () => {
    const rates = [
      base,
      { ...base, id: 'b', worker_id: 'other', unit_rate: 50000 },
      { ...base, id: 'c', worker_id: 'worker', unit_rate: 9000 },
    ];
    expect(selectLaborRate(rates, 'mat', 'weave', 'worker', '2026-11-02')?.unit_rate).toBe(9000);
    expect(selectLaborRate(rates, 'unknown', 'weave', 'worker', '2026-11-02')).toBeUndefined();
  });
  it('zero wage requires both roles and explicit policy', () => {
    expect(hasZeroWage(['OWNER', 'WORKER'], true)).toBe(true);
    expect(hasZeroWage(['OWNER', 'WORKER'], false)).toBe(false);
    expect(hasZeroWage(['WORKER'], true)).toBe(false);
  });
});
describe('permissions', () => {
  it('does not expose financial or admin permissions to workers', () => {
    expect(can(['WORKER'], 'view_financials')).toBe(false);
    expect(can(['WORKER'], 'view_audit')).toBe(false);
    expect(can(['OWNER'], 'manage_users')).toBe(false);
    expect(can(['ADMIN'], 'view_audit')).toBe(true);
  });
  it('keeps worker access personal', () => {
    expect(canReadWork(['WORKER'], 'me', 'someone')).toBe(false);
    expect(canReadWork(['WORKER'], 'me', 'me')).toBe(true);
    expect(canReadWork([], 'me', 'me')).toBe(false);
  });
  it('supports owner participation without implicit worker privileges', () => {
    expect(can(['OWNER', 'WORKER'], 'submit_work')).toBe(true);
    expect(can(['OWNER'], 'submit_work')).toBe(false);
  });
});
it('uses Vietnam business date across UTC midnight', () => {
  expect(businessDate(new Date('2026-11-01T18:00:00Z'))).toBe('2026-11-02');
});
it('rejects invalid server action inputs', () => {
  expect(workSchema.safeParse({ quantity: 0, work_date: '2026-02-30' }).success).toBe(false);
});
