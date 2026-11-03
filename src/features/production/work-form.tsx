'use client';
import { Select } from '@/components/ui/select';
import { MatSelect } from '@/components/ui/mat-select';
import { DatePicker } from '@/components/ui/date-picker';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { defaultWorkQuantity } from './defaults';
import { Check } from 'lucide-react';
import { workSchema, type WorkInput } from './schemas';
import { calculateWage, selectLaborRate } from './calculations';
import { submitWork } from './actions';
import { StageIcon } from './stage-icon';
import { money } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { useOnline } from '@/components/layout/pwa';
import type { MatType, Stage, LaborRate } from '@/types/domain';
import { toast } from 'sonner';
import { useCloseDialog } from '@/components/ui/dialog';
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
  const closeDialog = useCloseDialog();
  const online = useOnline();
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const selection = useUiStore((state) => state.productionSelection);
  const rememberSelection = useUiStore((state) => state.setProductionSelection);
  const startingStage =
    selection?.workerId === workerId && stages.some((s) => s.id === selection.stageId)
      ? selection.stageId
      : (stages[0]?.id ?? '');
  const form = useForm<WorkInput>({
    resolver: zodResolver(workSchema),
    defaultValues: {
      work_date: today,
      stage_id:
        selection?.workerId === workerId && stages.some((s) => s.id === selection.stageId)
          ? selection.stageId
          : (stages[0]?.id ?? ''),
      mat_type_id:
        stages.find((s) => s.id === startingStage)?.code === 'OTHER'
          ? null
          : selection?.workerId === workerId && mats.some((m) => m.id === selection.matTypeId)
            ? selection.matTypeId
            : (mats[0]?.id ?? ''),
      quantity: defaultWorkQuantity(stages, startingStage),
      idempotency_key: crypto.randomUUID(),
      expected_rate: 0,
    },
  });
  // Watching the three price inputs keeps the preview synchronized with the selected work date.
  const [date, stage, mat, quantity] = useWatch({
    control: form.control,
    name: ['work_date', 'stage_id', 'mat_type_id', 'quantity'],
  });
  const isWeaving = stages.find((s) => s.id === stage)?.code === 'WEAVING';
  const tracksStock = ['WEAVING', 'TYING', 'CUTTING', 'SEWING'].includes(
    stages.find((s) => s.id === stage)?.code ?? '',
  );
  const rate = selectLaborRate(rates, isWeaving ? mat : null, stage, workerId, date);
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
      const result = await submitWork({
        ...values,
        mat_type_id: tracksStock ? values.mat_type_id : null,
        expected_rate: unitRate ?? 0,
      });
      setMessage(result.message);
      setSuccess(result.success);
      if (result.success) toast.success(result.message);
      else toast.error(result.message);
      if (result.success) {
        rememberSelection({
          workerId,
          matTypeId: values.mat_type_id ?? '',
          stageId: values.stage_id,
        });
        form.setValue('idempotency_key', crypto.randomUUID());
        form.setValue('quantity', defaultWorkQuantity(stages, values.stage_id));
        router.refresh();
        closeDialog?.();
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
    <Card
      id="new-work"
      className="border-0 p-0 flex flex-1 flex-col min-h-0 overflow-hidden bg-transparent shadow-none"
    >
      <form
        onSubmit={form.handleSubmit(save)}
        className="flex flex-1 flex-col min-h-0 overflow-hidden"
      >
        {/* Scrollable Fields */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <Field
            id="work_date"
            label="Ngày làm việc"
            error={error.work_date ? 'Ngày làm việc chưa hợp lệ.' : undefined}
          >
            <Controller
              control={form.control}
              name="work_date"
              render={({ field }) => (
                <DatePicker
                  id="work_date"
                  value={field.value ?? ''}
                  onValueChange={field.onChange}
                  min="2000-01-01"
                  max={today}
                />
              )}
            />
          </Field>
          <Field id="stage_id" label="Công đoạn">
            <Controller
              control={form.control}
              name="stage_id"
              render={({ field }) => (
                <Select
                  id="stage_id"
                  value={field.value ?? ''}
                  onValueChange={(value) => {
                    field.onChange(value);
                    form.setValue(
                      'mat_type_id',
                      stages.find((s) => s.id === value)?.code !== 'OTHER'
                        ? (mats[0]?.id ?? null)
                        : null,
                    );
                    form.setValue('quantity', defaultWorkQuantity(stages, value), {
                      shouldValidate: true,
                    });
                  }}
                  optionIcons={(val, small) => {
                    const s = stages.find((st) => st.id === val);
                    return s ? (
                      <StageIcon
                        name={s.name}
                        size={small ? 20 : 22}
                        className="rounded-md border border-border/70"
                      />
                    ) : null;
                  }}
                >
                  {stages.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              )}
            />
          </Field>
          {tracksStock && (
            <Field id="mat_type_id" label="Loại chiếu">
              <Controller
                control={form.control}
                name="mat_type_id"
                render={({ field }) => (
                  <MatSelect
                    id="mat_type_id"
                    mats={mats}
                    value={field.value ?? ''}
                    onValueChange={field.onChange}
                  />
                )}
              />
            </Field>
          )}
          <Field
            id="quantity"
            label={
              <>
                Số lượng hoàn thành{' '}
                <span className="font-normal text-muted-foreground">(chiếu)</span>
              </>
            }
            error={error.quantity?.message}
          >
            <input
              id="quantity"
              type="number"
              inputMode="numeric"
              min={1}
              max={1000000}
              step={1}
              aria-invalid={!!error.quantity}
              {...form.register('quantity', { valueAsNumber: true })}
            />
          </Field>
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
                ? 'Đang áp dụng chính sách ghi công không nhận lương.'
                : 'Nhập xong là ghi nhận ngay vào tiền công của bạn.'}
            </p>
          </div>
          <Field id="notes" label="Ghi chú (tùy chọn)">
            <textarea
              id="notes"
              rows={2}
              {...form.register('notes')}
              placeholder="Nhập ghi chú thêm nếu có..."
              maxLength={500}
              className="w-full rounded-xl border border-border bg-card p-2.5 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all resize-none"
            />
          </Field>
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
        </div>

        {/* Fixed Pinned Footer */}
        <div className="flex flex-none items-center justify-end gap-3 border-t border-border/60 bg-card p-3 sm:px-6 sm:py-3.5">
          {closeDialog && (
            <Button type="button" variant="outline" onClick={() => closeDialog()}>
              Hủy
            </Button>
          )}
          <Button
            type="submit"
            disabled={
              form.formState.isSubmitting || !online || unitRate === undefined || amount === null
            }
          >
            <Check size={16} aria-hidden />
            {form.formState.isSubmitting ? 'Đang gửi…' : 'Gửi công đã làm'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
