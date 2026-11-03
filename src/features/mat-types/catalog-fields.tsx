import { Field } from '@/components/ui/field';
import { MatImageUpload } from './image-upload';
import type { MatType } from '@/types/domain';
export type MatDefaults = {
  cost_price?: number | null;
  sale_price: number;
  weaving_rate: number;
  sewing_rate: number;
  cutting_rate: number;
  tying_rate: number;
};
export function CatalogFields({ mat, prices }: { mat?: MatType; prices: MatDefaults }) {
  const id = mat?.id ?? 'new';
  return (
    <div className="space-y-4">
      <input name="id" type="hidden" value={mat?.id ?? ''} />
      <input name="code" type="hidden" value={mat?.code ?? ''} />
      <MatImageUpload id={`image-${id}`} initialPath={mat?.image_path} />
      <Field id={`name-${id}`} label="Tên loại chiếu">
        <input
          id={`name-${id}`}
          name="name"
          defaultValue={mat?.name ?? ''}
          maxLength={120}
          required
        />
      </Field>
      <Field id={`dimensions-${id}`} label="Kích thước">
        <input
          id={`dimensions-${id}`}
          name="dimensions"
          defaultValue={mat?.dimensions ?? ''}
          maxLength={120}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            ['sale_price', 'Giá bán (đ/chiếc)'],
            ['weaving_rate', 'Công dệt (đ/chiếc)'],
            ['sewing_rate', 'Công may (đ/chiếc)'],
            ['cutting_rate', 'Công cắt (đ/chiếc)'],
            ['tying_rate', 'Công buộc (đ/chiếc)'],
          ] as const
        ).map(([key, label]) => (
          <Field key={key} id={`${key}-${id}`} label={label}>
            <input
              id={`${key}-${id}`}
              name={key}
              type="number"
              inputMode="numeric"
              min={0}
              max={1000000000}
              step={1}
              defaultValue={prices[key]}
              required
            />
          </Field>
        ))}
      </div>
      <Field
        id={`cost-${id}`}
        label="Giá vốn mỗi chiếc (đ)"
        hint="Giá vốn do chủ nhập, đã gồm nguyên liệu và tiền công. Để trống nếu chưa biết; 0 nghĩa là giá vốn bằng 0."
      >
        <input
          id={`cost-${id}`}
          name="cost_price"
          type="number"
          inputMode="numeric"
          min={0}
          max={1000000000}
          step={1}
          defaultValue={prices.cost_price ?? ''}
          placeholder="Chưa thiết lập"
        />
      </Field>
      <p className="text-xs text-muted-foreground">
        May, cắt và buộc dùng chung cho mọi loại chiếu. Công buộc 500đ/chiếc tương đương 1.000đ/2
        chiếc.
      </p>
      <Field id={`description-${id}`} label="Ghi chú">
        <textarea
          id={`description-${id}`}
          name="description"
          maxLength={1000}
          defaultValue={mat?.description ?? ''}
        />
      </Field>
      <label className="checkbox-card">
        <input name="active" type="checkbox" defaultChecked={mat?.active ?? true} />
        Đang sử dụng
      </label>
    </div>
  );
}
