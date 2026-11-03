import { z } from 'zod';
import { dateSchema } from '@/features/production/schemas';
export const paymentMethodSchema = z.enum(['CASH', 'BANK']);
export const amountSchema = z.number().int().min(1).max(1_000_000_000_000_000);
export const wagePaymentSchema = z
  .object({
    worker_id: z.uuid(),
    payment_date: dateSchema,
    amount: amountSchema,
    method: paymentMethodSchema,
    notes: z.string().max(1000).default(''),
    idempotency_key: z.uuid(),
    allocations: z
      .array(z.object({ work_log_id: z.uuid(), amount: amountSchema }))
      .min(1)
      .max(500),
  })
  .superRefine((v, ctx) => {
    if (new Set(v.allocations.map((a) => a.work_log_id)).size !== v.allocations.length)
      ctx.addIssue({ code: 'custom', message: 'Không phân bổ trùng công.' });
    const sum = v.allocations.reduce((total, a) => total + BigInt(a.amount), 0n);
    if (sum !== BigInt(v.amount))
      ctx.addIssue({ code: 'custom', message: 'Tổng phân bổ phải bằng số tiền trả.' });
  });
export type WagePaymentInput = z.input<typeof wagePaymentSchema>;
