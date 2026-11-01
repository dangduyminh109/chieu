import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const badgeVariants = cva(
  'inline-flex max-w-full items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold leading-4',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-muted text-foreground',
        outline: 'border border-border bg-transparent text-foreground',
        success: 'bg-emerald-50 text-emerald-900',
        warning: 'bg-amber-50 text-amber-900',
        destructive: 'bg-red-50 text-destructive',
      },
    },
    defaultVariants: { variant: 'secondary' },
  },
);
export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>;
export function Badge({
  className,
  variant,
  ...props
}: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
