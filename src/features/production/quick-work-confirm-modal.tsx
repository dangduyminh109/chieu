'use client';

import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { displayDate } from '@/lib/utils';

export function QuickWorkConfirmModal({
  open,
  onClose,
  onConfirm,
  date,
  oldQuantity,
  newQuantity,
  isSubmitting,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  date: string;
  oldQuantity: number;
  newQuantity: number;
  isSubmitting: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-2xl">
        <div className="flex items-center gap-3 text-primary">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/15">
            <AlertCircle size={22} />
          </div>
          <h3 className="text-base font-bold text-foreground">Xác nhận sửa đổi số lượng</h3>
        </div>

        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          Bạn có chắc chắn muốn cập nhật số lượng chiếu ngày{' '}
          <strong className="text-foreground">{displayDate(date)}</strong>?
        </p>

        <div className="my-3 rounded-xl bg-muted/50 p-3 text-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground block">Trước khi sửa</span>
            <span className="font-semibold text-foreground line-through opacity-70">
              {oldQuantity} chiếc
            </span>
          </div>
          <div className="text-right">
            <span className="text-xs text-primary font-bold block">Sau khi sửa</span>
            <span className="text-base font-extrabold text-primary">{newQuantity} chiếc</span>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1 text-xs"
          >
            Quay lại
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex-1 text-xs font-bold shadow-xs"
          >
            {isSubmitting ? 'Đang lưu…' : 'Xác nhận sửa'}
          </Button>
        </div>
      </div>
    </div>
  );
}
