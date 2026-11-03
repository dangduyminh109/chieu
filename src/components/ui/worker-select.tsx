'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Users } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { useDismissPicker } from './select';
import { cn } from '@/lib/utils';

export type WorkerOption = {
  id: string;
  name: string;
  avatar_path?: string | null;
  active?: boolean;
};

export function WorkerSelect({
  id,
  name,
  workers,
  value,
  defaultValue = '',
  onValueChange,
  allLabel,
  showAll = true,
  disabled,
  required,
  className,
}: {
  id: string;
  name?: string;
  workers: WorkerOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  allLabel?: string;
  showAll?: boolean;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}) {
  const initial = defaultValue;
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

  const chosen = workers.find((w) => w.id === selected);
  const computedAllLabel = allLabel ?? `Tất cả thợ (${workers.length} người)`;

  return (
    <details ref={details} className={cn('field-picker relative min-w-0', className)}>
      <summary
        id={id}
        aria-required={required}
        aria-disabled={disabled}
        onClick={(e) => {
          if (disabled) e.preventDefault();
        }}
        className="picker-trigger !min-h-[44px] !h-[44px] !py-1.5 !px-3 cursor-pointer"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1 text-left">
          {chosen ? (
            <>
              <Avatar path={chosen.avatar_path} name={chosen.name} className="size-7 text-xs ring-1 ring-border shrink-0" />
              <span className="font-semibold text-xs sm:text-sm text-foreground truncate">
                {chosen.name}
              </span>
            </>
          ) : (
            <>
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20">
                <Users size={14} />
              </div>
              <span className="font-semibold text-xs sm:text-sm text-foreground truncate">
                {computedAllLabel}
              </span>
            </>
          )}
        </div>
        <ChevronDown size={16} aria-hidden className="shrink-0 text-muted-foreground ml-2" />
      </summary>

      <input ref={input} type="hidden" name={name} value={selected} />

      {!disabled && (
        <div
          className="picker-menu !max-h-72 divide-y divide-border/40 p-1"
          role="group"
          aria-label="Danh sách thợ"
        >
          {showAll && (
            <button
              type="button"
              aria-pressed={selected === ''}
              className={cn(
                'flex w-full items-center justify-between gap-2.5 p-2 rounded-xl text-left transition-colors cursor-pointer',
                selected === ''
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'hover:bg-muted/60 text-foreground',
              )}
              onClick={() => {
                setInternal('');
                onValueChange?.('');
                if (details.current) details.current.open = false;
                details.current?.querySelector('summary')?.focus();
              }}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20">
                  <Users size={15} />
                </div>
                <span className="font-semibold text-xs sm:text-sm truncate">
                  {computedAllLabel}
                </span>
              </div>
              {selected === '' && <Check size={16} className="shrink-0 text-primary" />}
            </button>
          )}

          {workers.map((w) => {
            const isChosen = w.id === selected;
            return (
              <button
                key={w.id}
                type="button"
                aria-pressed={isChosen}
                className={cn(
                  'flex w-full items-center justify-between gap-2.5 p-2 rounded-xl text-left transition-colors cursor-pointer',
                  isChosen
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'hover:bg-muted/60 text-foreground',
                )}
                onClick={() => {
                  setInternal(w.id);
                  onValueChange?.(w.id);
                  if (details.current) details.current.open = false;
                  details.current?.querySelector('summary')?.focus();
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <Avatar path={w.avatar_path} name={w.name} className="size-8 text-xs shrink-0 ring-1 ring-border" />
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold text-xs sm:text-sm truncate block">{w.name}</span>
                    {w.active === false && (
                      <span className="text-[10px] text-muted-foreground block truncate">
                        Ngừng hoạt động
                      </span>
                    )}
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
