import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
export function Card({ className, ...props }: ComponentProps<'section'>) {
  return (
    <section
      className={cn('min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-6', className)}
      {...props}
    />
  );
}
