'use client';
import { useState } from 'react';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/ui/field';
import { StageIcon } from '@/features/production/stage-icon';
import type { MatType, Stage } from '@/types/domain';
export function LaborScopeFields({ mats, stages }: { mats: MatType[]; stages: Stage[] }) {
  const [stage, setStage] = useState(stages[0]?.id ?? '');
  const weaving = stages.find((s) => s.id === stage)?.code === 'WEAVING';
  return (
    <>
      <Field id="stage" label="Công đoạn">
        <Select
          id="stage"
          name="stage_id"
          value={stage}
          onValueChange={setStage}
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
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      {weaving ? (
        <Field id="mat" label="Loại chiếu">
          <Select id="mat" name="mat_type_id" required>
            {mats.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <>
          <input type="hidden" name="mat_type_id" value="" />
          <p className="text-xs text-muted-foreground">
            Đơn giá chung theo công đoạn, không phân biệt loại chiếu.
          </p>
        </>
      )}
    </>
  );
}
