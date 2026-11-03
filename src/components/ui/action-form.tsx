'use client';

import { Save } from 'lucide-react';
import { useActionState, useEffect } from 'react';
import { toast } from 'sonner';
import { useFormStatus } from 'react-dom';
import { Button } from './button';
import { useCloseDialog } from './dialog';
import type { ActionResult } from '@/types/domain';
import { useOnline } from '@/components/layout/pwa';
import { cn } from '@/lib/utils';

export function SubmitButton({
  children,
  variant = 'default',
}: {
  children: React.ReactNode;
  variant?: 'default' | 'destructive' | 'outline';
}) {
  const { pending } = useFormStatus();
  const online = useOnline();
  return (
    <Button type="submit" variant={variant} disabled={pending || !online}>
      <Save size={16} aria-hidden />
      {pending ? 'Đang lưu…' : children}
    </Button>
  );
}

export function ActionForm({
  action,
  children,
  submitLabel = 'Lưu thay đổi',
  variant = 'default',
  className,
}: {
  action: (state: ActionResult, form: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  submitLabel?: string;
  variant?: 'default' | 'destructive' | 'outline';
  className?: string;
}) {
  const closeDialog = useCloseDialog();
  const inDialog = Boolean(closeDialog);
  const [state, formAction] = useActionState(action, { success: false, message: '' });

  useEffect(() => {
    if (state.message) {
      if (state.success) {
        toast.success(state.message);
        closeDialog?.();
      } else toast.error(state.message);
    }
  }, [state, closeDialog]);

  if (inDialog) {
    return (
      <form action={formAction} className={cn('flex flex-1 flex-col min-h-0 overflow-hidden', className)}>
        {/* Scrollable Main Form Fields */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {children}
          <div aria-live="polite">
            {state.message && (
              <p
                role={state.success ? 'status' : 'alert'}
                className={`rounded-xl p-3 text-sm ${
                  state.success ? 'bg-muted text-primary' : 'bg-red-50 text-destructive'
                }`}
              >
                {state.message}
              </p>
            )}
          </div>
        </div>

        {/* Fixed Pinned Footer */}
        <div className="flex flex-none items-center justify-end gap-3 border-t border-border/60 bg-card p-3 sm:px-6 sm:py-3.5">
          <Button
            type="button"
            variant="outline"
            onClick={() => closeDialog?.()}
          >
            Hủy
          </Button>
          <SubmitButton variant={variant}>{submitLabel}</SubmitButton>
        </div>
      </form>
    );
  }

  return (
    <form action={formAction} className={className ?? 'space-y-4'}>
      {children}
      <div aria-live="polite">
        {state.message && (
          <p
            role={state.success ? 'status' : 'alert'}
            className={`mb-4 rounded-xl p-3 text-sm ${
              state.success ? 'bg-muted text-primary' : 'bg-red-50 text-destructive'
            }`}
          >
            {state.message}
          </p>
        )}
      </div>
      <div className="flex justify-end">
        <SubmitButton variant={variant}>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
