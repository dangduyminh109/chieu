'use client';
import { useActionState, useEffect } from 'react';
import { toast } from 'sonner';
import { useFormStatus } from 'react-dom';
import { Button } from './button';
import type { ActionResult } from '@/types/domain';
import { useOnline } from '@/components/layout/pwa';
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
  const [state, formAction] = useActionState(action, { success: false, message: '' });
  useEffect(() => {
    if (state.message) {
      if (state.success) toast.success(state.message);
      else toast.error(state.message);
    }
  }, [state]);
  return (
    <form action={formAction} className={className ?? 'space-y-4'}>
      {children}
      <div aria-live="polite">
        {state.message && (
          <p
            role={state.success ? 'status' : 'alert'}
            className={`mb-4 rounded-xl p-3 text-sm ${state.success ? 'bg-muted text-primary' : 'bg-red-50 text-destructive'}`}
          >
            {state.message}
          </p>
        )}
      </div>
      <SubmitButton variant={variant}>{submitLabel}</SubmitButton>
    </form>
  );
}
