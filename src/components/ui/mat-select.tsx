'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Check, ChevronDown, Layers } from 'lucide-react';
import { useDismissPicker } from './select';
import { matImageUrl } from '@/features/mat-types/image-url';
import { cn } from '@/lib/utils';
import type { MatType } from '@/types/domain';

export function MatSelect({
  id,
  name,
  mats,
  value,
  defaultValue,
  onValueChange,
  placeholder = 'Chọn một loại chiếu',
  disabled,
  required,
  className,
}: {
  id: string;
  name?: string;
  mats: MatType[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}) {
  const initial = defaultValue ?? mats[0]?.id ?? '';
  const [internal, setInternal] = useState(initial);
  const selected = value !== undefined ? value : internal;
  const details = useRef<HTMLDetailsElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useDismissPicker(details);

  useEffect(() => {
    const form = input.current?.form;
    const reset = () => setInternal(initial);
    form?.addEventListener('reset', reset);
    return () => form?.removeEventListener('reset', reset);
  }, [initial]);

  const selectedMat = mats.find((m) => m.id === selected);

  return (
    <details ref={details} className={cn('field-picker relative min-w-0', className)}>
      <summary
        id={id}
        aria-required={required}
        aria-disabled={disabled}
        onClick={(e) => {
          if (disabled) e.preventDefault();
        }}
        className="picker-trigger !min-h-[46px] !py-1.5 !px-3 cursor-pointer"
      >
        {selectedMat ? (
          <div className="flex items-center gap-2.5 min-w-0 flex-1 text-left">
            {selectedMat.image_path ? (
              <Image
                src={matImageUrl(selectedMat.image_path)!}
                alt={selectedMat.name}
                width={34}
                height={34}
                unoptimized
                className="size-8.5 rounded-lg border border-border/80 object-cover shrink-0 shadow-2xs"
              />
            ) : (
              <div className="size-8.5 rounded-lg border border-border/70 bg-muted/60 flex items-center justify-center shrink-0 text-muted-foreground/60">
                <Layers size={16} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs sm:text-sm text-foreground truncate">
                  {selectedMat.name}
                </span>
                <span className="rounded bg-muted px-1.5 py-0.2 font-mono text-[10px] text-muted-foreground shrink-0">
                  {selectedMat.code}
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground block truncate">
                {selectedMat.dimensions || 'Kích thước chuẩn'}
              </span>
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground text-xs sm:text-sm">{placeholder}</span>
        )}
        <ChevronDown size={16} aria-hidden className="shrink-0 text-muted-foreground ml-2" />
      </summary>

      <input ref={input} type="hidden" name={name} value={selected} />

      {!disabled && (
        <div
          className="picker-menu !max-h-72 divide-y divide-border/40 p-1"
          role="group"
          aria-label="Các loại chiếu"
        >
          {mats.map((m) => {
            const isChosen = m.id === selected;
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={isChosen}
                className={cn(
                  'flex w-full items-center justify-between gap-2.5 p-2 rounded-xl text-left transition-colors cursor-pointer',
                  isChosen
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'hover:bg-muted/60 text-foreground',
                )}
                onClick={() => {
                  setInternal(m.id);
                  onValueChange?.(m.id);
                  if (details.current) details.current.open = false;
                  details.current?.querySelector('summary')?.focus();
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {m.image_path ? (
                    <Image
                      src={matImageUrl(m.image_path)!}
                      alt={m.name}
                      width={38}
                      height={38}
                      unoptimized
                      className="size-9 rounded-lg border border-border/80 object-cover shrink-0 shadow-2xs"
                    />
                  ) : (
                    <div className="size-9 rounded-lg border border-border/70 bg-muted/60 flex items-center justify-center shrink-0 text-muted-foreground/60">
                      <Layers size={16} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs sm:text-sm truncate">{m.name}</span>
                      <span className="rounded bg-muted px-1.5 py-0.2 font-mono text-[10px] text-muted-foreground shrink-0">
                        {m.code}
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground block truncate">
                      {m.dimensions || 'Kích thước chuẩn'}
                    </span>
                  </div>
                </div>
                {isChosen && <Check size={16} className="shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </details>
  );
}
