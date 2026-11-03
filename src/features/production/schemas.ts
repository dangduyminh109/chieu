import { z } from 'zod';
import { businessDate } from '@/lib/utils';
export const dateSchema = z.iso
  .date()
  .refine((v) => v >= '2000-01-01' && v <= '2100-12-31', 'Ngày không hợp lệ.');
export const workDateSchema = dateSchema.refine(
  (value) => value <= businessDate(),
  'Không thể ghi công cho ngày trong tương lai.',
);
export const workSchema = z.object({
  work_date: workDateSchema,
  stage_id: z.uuid(),
  mat_type_id: z.uuid().nullable(),
  quantity: z
    .number()
    .int('Nhập số chiếu nguyên.')
    .min(1, 'Số lượng phải lớn hơn 0.')
    .max(1_000_000, 'Số lượng quá lớn.'),
  idempotency_key: z.uuid(),
  expected_rate: z.number().int().min(0).max(1_000_000_000),
  notes: z.string().max(500, 'Ghi chú tối đa 500 ký tự.').optional().nullable(),
});
export type WorkInput = z.infer<typeof workSchema>;
