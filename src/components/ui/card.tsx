import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
export function Card({ className, ...props }: ComponentProps<'section'>) {
  return (
    <section className={cn('rounded-2xl border border-border bg-card p-6', className)} {...props} />
  );
}
