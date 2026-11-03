'use client';
import { useRef, useState } from 'react';
import { Minus, Plus, Delete } from 'lucide-react';
import { cn } from '@/lib/utils';

export function NumberStepper({
  id,
  value,
  onChange,
  min = 0,
  max = 1_000_000,
  step = 1,
  increments = [5, 10],
  money = false,
  suffix,
}: {
  id: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  increments?: number[];
  money?: boolean;
  suffix?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [cleared, setCleared] = useState(false);
  const label = (amount: number) => new Intl.NumberFormat('vi-VN').format(amount);
  const adjust = (amount: number) => {
    setCleared(false);
    onChange(Math.max(min, Math.min(max, value + amount)));
  };

  const text = cleared ? '' : label(value);
  const textLength = text.length;

  // Dynamically scale font size as digits increase to prevent truncation/overflow
  // <= 7 chars (e.g. 500.000): text-xl (20px)
  // 8-10 chars (e.g. 1.000.000, 10.000.000): text-base (16px)
  // 11-13 chars (e.g. 100.000.000): text-sm (14px)
  // > 13 chars (billions): text-xs (12px)
  const fontSizeClass =
    textLength > 13
      ? '!text-xs'
      : textLength > 10
        ? '!text-sm'
        : textLength > 7
          ? '!text-base sm:!text-lg'
          : '!text-xl';

  return (
    <div className="min-w-0">
      <div className="grid grid-cols-[48px_minmax(0,1fr)_48px] items-center gap-2">
        <button
          type="button"
          aria-label={money ? `Giảm ${label(step)} đồng` : `Giảm ${step}`}
          disabled={value <= min}
          onClick={() => adjust(-step)}
          className="flex size-12 items-center justify-center rounded-xl border border-border bg-muted text-primary disabled:opacity-40 transition-colors"
        >
          <Minus size={22} aria-hidden />
        </button>
        <div
          onClick={() => inputRef.current?.focus()}
          className="flex min-h-12 min-w-0 cursor-text items-center justify-center gap-1 rounded-xl border border-border bg-card px-2.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 overflow-hidden"
        >
          <input
            id={id}
            type="text"
            inputMode="numeric"
            ref={inputRef}
            value={text}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => {
              setCleared(e.target.value === '');
              const raw = e.target.value.replace(/[.\s,]/g, '');
              if (/^\d*$/.test(raw)) {
                const number = Number(raw);
                if (Number.isSafeInteger(number)) onChange(Math.min(max, number));
              }
            }}
            onBlur={() => {
              setCleared(false);
              if (value < min) onChange(min);
            }}
            aria-describedby={suffix ? `${id}-unit` : undefined}
            style={{
              width: `${Math.max(1, textLength) + 0.5}ch`,
              maxWidth: suffix ? 'calc(100% - 1.5rem)' : '100%',
            }}
            className={cn(
              '!min-h-12 min-w-0 !rounded-none !border-0 !bg-transparent !p-0 text-center font-bold tabular-nums !shadow-none focus:!outline-none shrink',
              fontSizeClass,
            )}
          />
          {suffix && (
            <span
              id={`${id}-unit`}
              className="pointer-events-none shrink-0 text-xs font-semibold text-muted-foreground whitespace-nowrap"
            >
              {suffix}
            </span>
          )}
        </div>
        <button
          type="button"
          aria-label={money ? `Tăng ${label(step)} đồng` : `Tăng ${step}`}
          disabled={value >= max}
          onClick={() => adjust(step)}
          className="flex size-12 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary disabled:opacity-40 transition-colors"
        >
          <Plus size={22} aria-hidden />
        </button>
      </div>
      {increments.length > 0 && (
        <div className="mt-2 flex items-center gap-1.5 w-full">
          <div
            className="grid flex-1 gap-1.5 min-w-0"
            style={{
              gridTemplateColumns: `repeat(${increments.length}, minmax(0, 1fr))`,
            }}
          >
            {increments.map((inc) => (
              <button
                key={inc}
                type="button"
                onClick={() => adjust(inc)}
                className="flex h-10 min-w-0 items-center justify-center rounded-xl border border-border bg-card px-2 text-xs font-semibold text-primary hover:bg-muted active:scale-95 transition-all"
              >
                <span className="truncate">
                  +{label(inc)}
                  {suffix ? ` ${suffix}` : ''}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-label="Xóa hết"
            onClick={() => {
              setCleared(true);
              onChange(min);
              inputRef.current?.focus();
            }}
            className="flex h-10 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 transition-all"
          >
            <Delete size={18} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
