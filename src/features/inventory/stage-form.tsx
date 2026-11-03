'use client';
import { useState } from 'react';
import { ActionForm } from '@/components/ui/action-form';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { MatSelect } from '@/components/ui/mat-select';
import { NumberStepper } from '@/components/ui/number-stepper';
import { StageIcon } from '@/features/production/stage-icon';
import { saveMatStock } from './stage-actions';
import type { MatType } from '@/types/domain';

export const matStageLabels = {
  WOVEN: 'Đã dệt, chưa buộc',
  TIED: 'Đã buộc, chưa cắt',
  CUT: 'Đã cắt, chưa may',
  SEWN: 'Đã may',
};
export function MatStageForm({
  mats,
  mode,
  initialMat,
  initialStage,
}: {
  mats: { id: string; name: string; image_path?: string | null; dimensions?: string | null; code?: string }[];
  mode: 'ADD' | 'ADVANCE';
  initialMat?: string;
  initialStage?: string;
}) {
  const [mat, setMat] = useState(initialMat ?? mats[0]?.id ?? '');
  const [stage, setStage] = useState(initialStage ?? 'WOVEN');
  const [quantity, setQuantity] = useState(10);
  const [key] = useState(() => crypto.randomUUID());
  return (
    <ActionForm
      action={saveMatStock}
      submitLabel={mode === 'ADD' ? 'Thêm vào kho' : 'Xác nhận đã làm'}
    >
      <input type="hidden" name="key" value={key} />
      <input type="hidden" name="mode" value={mode} />
      <Field id="stock-mat" label="Loại chiếu">
        <MatSelect
          id="stock-mat"
          name="mat"
          mats={mats as unknown as MatType[]}
          value={mat}
          onValueChange={setMat}
        />
      </Field>
      <Field id="stock-stage" label={mode === 'ADD' ? 'Tình trạng hiện tại' : 'Chiếu đang ở bước'}>
        <Select
          id="stock-stage"
          name="stage"
          value={stage}
          onValueChange={setStage}
          optionIcons={(val, small) => (
            <StageIcon
              name={matStageLabels[val as keyof typeof matStageLabels] ?? val}
              size={small ? 20 : 22}
              className="rounded-md border border-border/70"
            />
          )}
        >
          {Object.entries(matStageLabels)
            .filter(([code]) => mode === 'ADD' || code !== 'SEWN')
            .map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
        </Select>
      </Field>
      {mode === 'ADVANCE' && (
        <p className="rounded-xl bg-muted p-3 text-sm font-semibold text-primary">
          {stage === 'WOVEN'
            ? 'Xác nhận đã buộc'
            : stage === 'TIED'
              ? 'Xác nhận đã cắt'
              : 'Xác nhận đã may'}
        </p>
      )}
      <Field id="stock-quantity" label="Số lượng">
        <input type="hidden" name="quantity" value={quantity} />
        <NumberStepper
          id="stock-quantity"
          value={quantity}
          onChange={setQuantity}
          min={1}
          max={1000000}
          increments={[5, 10, 20, 50]}
          suffix="chiếc"
        />
      </Field>
      <input
        type="hidden"
        name="notes"
        value={mode === 'ADD' ? 'Chủ ghi nhận số chiếu thực tế' : 'Cập nhật tiến độ chiếu'}
      />
      <p className="text-xs text-muted-foreground">
        {mode === 'ADD'
          ? 'Thêm số chiếu có sẵn tại cơ sở nhưng chưa ghi vào ứng dụng. Chiếu đã ghi công hoặc ghi mua thì không cần thêm lại.'
          : 'Dùng khi chiếu đã buộc, cắt hoặc may nhưng chưa có ai ghi công trong ứng dụng.'}{' '}
        Chỉ cập nhật số chiếu, không tính tiền công.
      </p>
    </ActionForm>
  );
}
