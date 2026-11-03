'use client';
import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Check, ChevronDown } from 'lucide-react';
import { businessDate } from '@/lib/utils';
import { useDismissPicker } from './select';

function iso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function DatePicker({
  id,
  name,
  value,
  defaultValue,
  min = '2000-01-01',
  max = '2100-12-31',
  onValueChange,
  required,
}: {
  id: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  min?: string;
  max?: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
}) {
  const initial = defaultValue ?? businessDate();
  const [internal, setInternal] = useState(initial);
  const selected = value ?? internal;
  const [month, setMonth] = useState(() => new Date(`${selected || initial}T12:00:00`));
  const [viewMode, setViewMode] = useState<'days' | 'months' | 'years'>('days');
  const details = useRef<HTMLDetailsElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useDismissPicker(details);

  useEffect(() => {
    const form = input.current?.form;
    const reset = () => setInternal(initial);
    form?.addEventListener('reset', reset);
    return () => form?.removeEventListener('reset', reset);
  }, [initial]);

  const choose = (date: string) => {
    setInternal(date);
    onValueChange?.(date);
    setViewMode('days');
    if (details.current) details.current.open = false;
    details.current?.querySelector('summary')?.focus();
  };

  const year = month.getFullYear();
  const m = month.getMonth();
  const offset = (new Date(year, m, 1).getDay() + 6) % 7;
  const count = new Date(year, m + 1, 0).getDate();
  const move = (delta: number) => setMonth(new Date(year, m + delta, 1));
  const today = businessDate();
  const todayYear = Number(today.slice(0, 4));

  const minYear = Number(min.slice(0, 4));
  const maxYear = Number(max.slice(0, 4));

  // Year pagination for 'years' view mode (12 years per page)
  const [prevYear, setPrevYear] = useState(year);
  const [yearPageOffset, setYearPageOffset] = useState(0);
  if (prevYear !== year) {
    setPrevYear(year);
    setYearPageOffset(0);
  }
  const yearPage = Math.floor(year / 12) * 12 + yearPageOffset;

  const prevDisabled =
    viewMode === 'days'
      ? iso(new Date(year, m, 0)) < min
      : viewMode === 'months'
        ? year - 1 < minYear
        : yearPage <= minYear;

  const nextDisabled =
    viewMode === 'days'
      ? iso(new Date(year, m + 1, 1)) > max
      : viewMode === 'months'
        ? year + 1 > maxYear
        : yearPage + 11 >= maxYear;

  const handlePrev = () => {
    if (viewMode === 'days') move(-1);
    else if (viewMode === 'months') setMonth(new Date(year - 1, m, 1));
    else setYearPageOffset((o) => o - 12);
  };

  const handleNext = () => {
    if (viewMode === 'days') move(1);
    else if (viewMode === 'months') setMonth(new Date(year + 1, m, 1));
    else setYearPageOffset((o) => o + 12);
  };

  return (
    <details ref={details} className="field-picker relative min-w-0">
      <summary
        id={id}
        aria-required={required}
        className="picker-trigger flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground transition-colors hover:border-primary/50"
        onClick={() => {
          if (selected) {
            const d = new Date(`${selected}T12:00:00`);
            setMonth(d);
            setYearPageOffset(0);
          }
          setViewMode('days');
        }}
      >
        <span className="flex min-w-0 items-center gap-2">
          <CalendarDays size={16} aria-hidden className="shrink-0 text-primary" />
          <span className="font-medium">
            {selected ? selected.split('-').reverse().join('/') : 'Chọn ngày'}
          </span>
        </span>
      </summary>

      <input ref={input} type="hidden" name={name} value={selected} />

      <div
        className="picker-menu calendar-panel absolute left-0 z-50 mt-1.5 w-[300px] max-w-[calc(100vw-32px)] rounded-2xl border border-border bg-card p-3 shadow-xl max-sm:right-0 max-sm:left-auto"
        role="group"
        aria-label="Chọn ngày"
      >
        {/* Navigation header: Prev, Month Button, Year Button, Next */}
        <div className="mb-3 flex items-center gap-1.5">
          <button
            type="button"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-foreground hover:bg-muted active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
            aria-label="Trước"
            disabled={prevDisabled}
            onClick={handlePrev}
          >
            <ChevronLeft size={18} className="stroke-[2.2]" />
          </button>

          <div className="grid min-w-0 flex-1 grid-cols-2 gap-1.5">
            {/* Custom Month Selector Button */}
            <button
              type="button"
              onClick={() => setViewMode((v) => (v === 'months' ? 'days' : 'months'))}
              className={`flex h-9 w-full items-center justify-between rounded-lg border px-2.5 text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                viewMode === 'months'
                  ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30'
                  : 'border-border bg-card text-foreground hover:bg-muted'
              }`}
              aria-label="Chọn tháng"
            >
              <span className="truncate">Tháng {m + 1}</span>
              <ChevronDown
                size={14}
                className={`shrink-0 text-muted-foreground transition-transform duration-200 ${
                  viewMode === 'months' ? 'rotate-180 text-primary' : ''
                }`}
              />
            </button>

            {/* Custom Year Selector Button */}
            <button
              type="button"
              onClick={() => setViewMode((v) => (v === 'years' ? 'days' : 'years'))}
              className={`flex h-9 w-full items-center justify-between rounded-lg border px-2.5 text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                viewMode === 'years'
                  ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30'
                  : 'border-border bg-card text-foreground hover:bg-muted'
              }`}
              aria-label="Chọn năm"
            >
              <span className="truncate">
                {viewMode === 'years' ? `${yearPage} - ${yearPage + 11}` : year}
              </span>
              <ChevronDown
                size={14}
                className={`shrink-0 text-muted-foreground transition-transform duration-200 ${
                  viewMode === 'years' ? 'rotate-180 text-primary' : ''
                }`}
              />
            </button>
          </div>

          <button
            type="button"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-foreground hover:bg-muted active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
            aria-label="Sau"
            disabled={nextDisabled}
            onClick={handleNext}
          >
            <ChevronRight size={18} className="stroke-[2.2]" />
          </button>
        </div>

        {/* 1. DAYS VIEW */}
        {viewMode === 'days' && (
          <>
            {/* Weekday headers */}
            <div className="grid grid-cols-7 text-center font-medium">
              {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => (
                <span key={day} className="py-1 text-xs text-muted-foreground font-semibold">
                  {day}
                </span>
              ))}
            </div>

            {/* Calendar days grid */}
            <div className="mt-1 grid grid-cols-7 gap-1 text-center">
              {Array.from({ length: offset }, (_, i) => (
                <span key={`blank-${i}`} />
              ))}

              {Array.from({ length: count }, (_, i) => {
                const date = iso(new Date(year, m, i + 1));
                const isSelected = date === selected;
                const isToday = date === today;
                const isDisabled = date < min || date > max;

                return (
                  <button
                    type="button"
                    key={date}
                    className={`flex h-9 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                      isSelected
                        ? 'bg-primary text-white font-bold shadow-xs'
                        : isToday
                          ? 'border border-primary font-bold text-primary hover:bg-muted'
                          : 'hover:bg-muted text-foreground'
                    } ${isDisabled ? 'opacity-25 cursor-not-allowed pointer-events-none' : 'cursor-pointer active:scale-95'}`}
                    aria-label={date.split('-').reverse().join('/')}
                    aria-pressed={isSelected}
                    aria-current={isToday ? 'date' : undefined}
                    disabled={isDisabled}
                    onClick={() => choose(date)}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* 2. MONTHS VIEW */}
        {viewMode === 'months' && (
          <div className="py-1">
            <div className="text-[11px] font-semibold text-muted-foreground text-center mb-2">
              Chọn tháng trong năm {year}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 12 }, (_, i) => {
                const isSelectedMonth = i === m;
                const isTodayMonth =
                  year === todayYear && i + 1 === Number(today.slice(5, 7));
                const monthStartIso = iso(new Date(year, i, 1));
                const monthEndIso = iso(new Date(year, i + 1, 0));
                const isDisabledMonth = monthEndIso < min || monthStartIso > max;

                return (
                  <button
                    key={i}
                    type="button"
                    disabled={isDisabledMonth}
                    onClick={() => {
                      setMonth(new Date(year, i, 1));
                      setViewMode('days');
                    }}
                    className={`flex flex-col items-center justify-center h-12 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                      isDisabledMonth
                        ? 'opacity-25 cursor-not-allowed pointer-events-none border border-dashed border-border/40 text-muted-foreground/40 bg-muted/10'
                        : isSelectedMonth
                          ? 'bg-primary text-white shadow-xs font-black ring-2 ring-primary/40'
                          : isTodayMonth
                            ? 'border-2 border-primary/60 bg-primary/10 text-primary hover:bg-primary/20 font-bold'
                            : 'border border-border/80 bg-card hover:bg-muted text-foreground'
                    } cursor-pointer active:scale-95`}
                  >
                    <span>Tháng {i + 1}</span>
                    {isTodayMonth && !isSelectedMonth && (
                      <span className="text-[9px] font-semibold text-primary">Hiện tại</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. YEARS VIEW */}
        {viewMode === 'years' && (
          <div className="py-1">
            <div className="text-[11px] font-semibold text-muted-foreground text-center mb-2">
              Chọn năm ({yearPage} - {yearPage + 11})
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 12 }, (_, i) => {
                const y = yearPage + i;
                const isSelectedYear = y === year;
                const isTodayYear = y === todayYear;
                const isDisabledYear = y < minYear || y > maxYear;

                return (
                  <button
                    key={y}
                    type="button"
                    disabled={isDisabledYear}
                    onClick={() => {
                      setMonth(new Date(y, m, 1));
                      setViewMode('days');
                    }}
                    className={`flex flex-col items-center justify-center h-12 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                      isDisabledYear
                        ? 'opacity-25 cursor-not-allowed pointer-events-none border border-dashed border-border/40 text-muted-foreground/40 bg-muted/10'
                        : isSelectedYear
                          ? 'bg-primary text-white shadow-xs font-black ring-2 ring-primary/40'
                          : isTodayYear
                            ? 'border-2 border-primary/60 bg-primary/10 text-primary hover:bg-primary/20 font-bold'
                            : 'border border-border/80 bg-card hover:bg-muted text-foreground'
                    } cursor-pointer active:scale-95`}
                  >
                    <span>{y}</span>
                    {isTodayYear && !isSelectedYear && (
                      <span className="text-[9px] font-semibold text-primary">Hiện tại</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Back to days view button (if in months or years mode) */}
        {viewMode !== 'days' && (
          <button
            type="button"
            onClick={() => setViewMode('days')}
            className="mt-2.5 flex h-8 w-full items-center justify-center gap-1 rounded-lg border border-border/70 bg-card text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-all cursor-pointer active:scale-95"
          >
            <ChevronLeft size={14} />
            <span>Quay lại xem ngày</span>
          </button>
        )}

        {/* Quick select "Hôm nay" */}
        <button
          type="button"
          className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-muted text-xs font-semibold text-primary transition-colors hover:bg-muted/80 disabled:opacity-40 cursor-pointer active:scale-98"
          disabled={today < min || today > max}
          onClick={() => choose(today)}
        >
          <Check size={14} aria-hidden />
          Hôm nay ({today.split('-').reverse().join('/')})
        </button>
      </div>
    </details>
  );
}
