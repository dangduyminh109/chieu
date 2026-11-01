import { z } from 'zod';
export const dateSchema = z.iso
  .date()
  .refine((v) => v >= '2000-01-01' && v <= '2100-12-31', 'Ngày không hợp lệ.');
export const workSchema = z.object({
  work_date: dateSchema,
  stage_id: z.uuid(),
  mat_type_id: z.uuid(),
  quantity: z
    .number()
    .int('Nhập số chiếu nguyên.')
    .min(1, 'Số lượng phải lớn hơn 0.')
    .max(1_000_000, 'Số lượng quá lớn.'),
  idempotency_key: z.uuid(),
  expected_rate: z.number().int().min(0).max(1_000_000_000),
});
export type WorkInput = z.infer<typeof workSchema>;
