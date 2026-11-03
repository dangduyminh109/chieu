'use client';
import { useState } from 'react';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { unitLabels, type Material } from '@/features/commerce/business-types';

export function MaterialFields({ material }: { material?: Material }) {
  const [sedge, setSedge] = useState(material?.is_sedge ?? false);
  const [unit, setUnit] = useState(material?.unit ?? 'KG');
  return (
    <>
      <input type="hidden" name="id" value={material?.id ?? ''} />
      <input type="hidden" name="code" value={material?.code ?? ''} />
      <Field id="material-name" label="Tên nguyên liệu">
        <input
          id="material-name"
          name="name"
          maxLength={120}
          defaultValue={material?.name ?? ''}
          placeholder="VD: Lát trắng, chỉ dệt, màu nhuộm…"
          required
        />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input
          name="is_sedge"
          type="checkbox"
          checked={sedge}
          onChange={(e) => {
            setSedge(e.target.checked);
            if (e.target.checked) setUnit('BUNDLE');
          }}
        />
        Lát mua theo từng bó, có cân nặng riêng
      </label>
      <Field id="material-unit" label="Đơn vị">
        <Select
          id="material-unit"
          name="unit"
          value={sedge ? 'BUNDLE' : unit}
          onValueChange={(value) => setUnit(value as Material['unit'])}
          disabled={sedge}
        >
          {Object.entries(unitLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input name="active" type="checkbox" defaultChecked={material?.active ?? true} />
        Đang sử dụng
      </label>
    </>
  );
}
