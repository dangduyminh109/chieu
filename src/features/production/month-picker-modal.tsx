'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, CalendarArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function MonthPickerModal({
  open,
  onClose,
  currentYear,
  currentMonth,
  today,
  onSelectMonth,
  onResetToCurrentMonth,
}: {
  open: boolean;
  onClose: () => void;
  currentYear: number;
  currentMonth: number;
  today: string;
  onSelectMonth: (year: number, month: number) => void;
  onResetToCurrentMonth: () => void;
}) {
  const [prevYear, setPrevYear] = useState(currentYear);
  const [yearOffset, setYearOffset] = useState(0);
  if (prevYear !== currentYear) {
    setPrevYear(currentYear);
    setYearOffset(0);
  }
  const pickerYear = currentYear + yearOffset;

  // Lock body scroll and handle Escape key for Month Picker modal
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
        onClick={onClose}
        aria-hidden
      />

      {/* Modal Dialog Window */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Chọn tháng"
        className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-card p-4 sm:p-5 text-foreground shadow-2xl animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <CalendarIcon className="size-5 text-primary" />
            <h3 className="font-bold text-base text-foreground">Chọn tháng</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng bảng chọn tháng"
            className="flex size-8 items-center justify-center rounded-full bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Year Switcher */}
        <div className="flex items-center justify-between my-4 px-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setYearOffset((o) => o - 1)}
            className="size-8 !p-0 rounded-lg hover:bg-muted active:scale-95 flex items-center justify-center"
            aria-label="Năm trước"
          >
            <ChevronLeft size={18} className="stroke-[2.5] shrink-0" />
          </Button>
          <div className="text-center">
            <span className="text-base font-black text-foreground">Năm {pickerYear}</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setYearOffset((o) => o + 1)}
            disabled={pickerYear >= Number(today.slice(0, 4))}
            className="size-8 !p-0 rounded-lg hover:bg-muted active:scale-95 flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none"
            aria-label="Năm sau"
          >
            <ChevronRight size={18} className="stroke-[2.5] shrink-0" />
          </Button>
        </div>

        {/* 12 Months Grid */}
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 12 }, (_, i) => {
            const m = i + 1;
            const isSelected = pickerYear === currentYear && m === currentMonth;
            const isTodayMonth =
              pickerYear === Number(today.slice(0, 4)) && m === Number(today.slice(5, 7));
            const isFutureMonth =
              pickerYear > Number(today.slice(0, 4)) ||
              (pickerYear === Number(today.slice(0, 4)) && m > Number(today.slice(5, 7)));

            return (
              <button
                key={m}
                type="button"
                disabled={isFutureMonth}
                onClick={() => !isFutureMonth && onSelectMonth(pickerYear, m)}
                className={`relative flex flex-col items-center justify-center py-3 px-2 rounded-xl text-center text-xs sm:text-sm font-bold transition-all ${
                  isFutureMonth
                    ? 'opacity-25 cursor-not-allowed pointer-events-none border border-dashed border-border/40 text-muted-foreground/40 bg-muted/10'
                    : isSelected
                      ? 'bg-primary text-white shadow-xs ring-2 ring-primary/40 font-black cursor-pointer active:scale-95'
                      : isTodayMonth
                        ? 'border-2 border-primary/60 bg-primary/10 text-primary hover:bg-primary/20 font-bold cursor-pointer active:scale-95'
                        : 'border border-border/80 bg-surface/80 hover:bg-muted/80 text-foreground cursor-pointer active:scale-95'
                }`}
              >
                <span>Tháng {m}</span>
                {isTodayMonth && !isSelected && (
                  <span className="text-[9px] font-semibold text-primary mt-0.5">
                    Hiện tại
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onResetToCurrentMonth}
            className="h-8.5 px-3 gap-1.5 text-xs text-primary font-semibold border-primary/30 hover:bg-primary/10 rounded-xl active:scale-95 transition-all shadow-2xs"
          >
            <CalendarArrowRight size={14} className="stroke-[2.2]" />
            <span>Về tháng hiện tại</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-8.5 text-xs font-semibold px-4 rounded-xl"
          >
            Đóng
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
