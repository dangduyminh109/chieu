'use client';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Plus, Check } from 'lucide-react';
import { workSchema, type WorkInput } from './schemas';
import { calculateWage, selectLaborRate } from './calculations';
import { submitWork } from './actions';
import { money } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useOnline } from '@/components/layout/pwa';
import type { MatType, Stage, LaborRate } from '@/types/domain';
import { toast } from 'sonner';
import { useUiStore } from '@/lib/stores/ui-store';
export function WorkForm({
  mats,
  stages,
  rates,
  workerId,
  today,
  zeroWage,
}: {
  mats: MatType[];
  stages: Stage[];
  rates: LaborRate[];
  workerId: string;
  today: string;
  zeroWage: boolean;
}) {
  const router = useRouter();
  const online = useOnline();
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const selection = useUiStore((state) => state.productionSelection);
  const rememberSelection = useUiStore((state) => state.setProductionSelection);
  const form = useForm<WorkInput>({
    resolver: zodResolver(workSchema),
    defaultValues: {
      work_date: today,
      stage_id:
        selection?.workerId === workerId && stages.some((s) => s.id === selection.stageId)
          ? selection.stageId
          : (stages[0]?.id ?? ''),
      mat_type_id:
        selection?.workerId === workerId && mats.some((m) => m.id === selection.matTypeId)
          ? selection.matTypeId
          : (mats[0]?.id ?? ''),
      quantity: 1,
      idempotency_key: crypto.randomUUID(),
      expected_rate: 0,
    },
  });
  // Watching the three price inputs keeps the preview synchronized with the selected work date.
  const [date, stage, mat, quantity] = useWatch({
    control: form.control,
    name: ['work_date', 'stage_id', 'mat_type_id', 'quantity'],
  });
  const rate = selectLaborRate(rates, mat, stage, workerId, date);
  const unitRate = zeroWage ? 0 : rate?.unit_rate;
  let amount: number | null = null;
  try {
    if (unitRate !== undefined) amount = calculateWage(quantity, unitRate);
  } catch {
    /* Inline validation below. */
  }
  async function save(values: WorkInput) {
    if (!online) return;
    setMessage('');
    setSuccess(false);
    try {
      const result = await submitWork({ ...values, expected_rate: unitRate ?? 0 });
      setMessage(result.message);
      setSuccess(result.success);
      if (result.success) toast.success(result.message);
      else toast.error(result.message);
      if (result.success) {
        rememberSelection({ workerId, matTypeId: values.mat_type_id, stageId: values.stage_id });
        form.setValue('idempotency_key', crypto.randomUUID());
        form.setValue('quantity', 1);
        router.refresh();
      }
    } catch {
      toast.error('Chưa xác nhận được kết quả lưu. Hãy kiểm tra kết nối và thử lại.');
      setMessage(
        'Chưa xác nhận được kết quả lưu. Hãy giữ nguyên thông tin và thử lại; hệ thống sẽ tránh gửi trùng.',
      );
    }
  }
  const error = form.formState.errors;
  return (
    <Card id="new-work">
      <h2 className="flex items-center gap-2 text-xl font-semibold">
        <Plus size={22} aria-hidden />
        Ghi công hôm nay
      </h2>
      <p className="mt-2 mb-6 text-sm text-muted-foreground">
        Chọn công đoạn, loại chiếu và số lượng đã làm.
      </p>
      <form onSubmit={form.handleSubmit(save)} className="space-y-6">
        <div>
          <label htmlFor="work_date">Ngày làm việc</label>
          <input
            id="work_date"
            type="date"
            min="2000-01-01"
            max={today}
            {...form.register('work_date')}
          />
          {error.work_date && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              Ngày làm việc chưa hợp lệ.
            </p>
          )}
        </div>
        <div>
          <label htmlFor="stage_id">Công đoạn</label>
          <select id="stage_id" {...form.register('stage_id')}>
            {stages.map((s) => (
              <option value={s.id} key={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="mat_type_id">Loại chiếu</label>
          <select id="mat_type_id" {...form.register('mat_type_id')}>
            {mats.map((m) => (
              <option value={m.id} key={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="quantity">
            Số lượng hoàn thành <span className="font-normal text-muted-foreground">(chiếu)</span>
          </label>
          <input
            id="quantity"
            type="number"
            inputMode="numeric"
            min={1}
            max={1000000}
            step={1}
            aria-invalid={!!error.quantity}
            aria-describedby={error.quantity ? 'quantity-error' : undefined}
            {...form.register('quantity', { valueAsNumber: true })}
          />
          {error.quantity && (
            <p id="quantity-error" role="alert" className="mt-2 text-sm text-destructive">
              {error.quantity.message}
            </p>
          )}
        </div>
        <div className="rounded-xl bg-muted p-4">
          <div className="flex justify-between gap-4 text-sm">
            <span>Đơn giá mỗi chiếu</span>
            <strong>{unitRate === undefined ? 'Chưa có đơn giá' : money(unitRate)}</strong>
          </div>
          <div className="mt-4 flex justify-between gap-4">
            <span>Tiền công ghi nhận</span>
            <strong className="text-2xl text-primary">
              {amount === null ? '—' : money(amount)}
            </strong>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {zeroWage
              ? 'Đang áp dụng chính sách chủ xưởng ghi công không nhận lương.'
              : 'Công gửi sẽ chờ duyệt. Đây chưa phải số tiền đến hạn thanh toán.'}
          </p>
        </div>
        {unitRate === undefined && (
          <p role="status" className="text-sm text-destructive">
            Nhờ người quản lý thiết lập đơn giá cho ngày và công đoạn đã chọn.
          </p>
        )}
        {message && (
          <p
            role={success ? 'status' : 'alert'}
            className={`rounded-xl p-3 text-sm ${success ? 'bg-muted text-primary' : 'bg-red-50 text-destructive'}`}
          >
            {success && <Check className="mr-2 inline" size={16} aria-hidden />}
            {message}
          </p>
        )}
        <Button
          className="w-full"
          type="submit"
          disabled={
            form.formState.isSubmitting || !online || unitRate === undefined || amount === null
          }
        >
          {form.formState.isSubmitting ? 'Đang gửi…' : 'Gửi công đã làm'}
        </Button>
      </form>
    </Card>
  );
}
