import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex shrink-0 whitespace-nowrap items-center justify-center gap-2 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        outline: 'border border-border bg-card hover:bg-muted text-foreground',
        ghost: 'hover:bg-muted text-foreground',
        destructive: 'bg-destructive text-white hover:bg-destructive/90',
      },
      size: {
        default:
          'min-h-11 px-4 py-2 text-sm rounded-xl max-sm:min-h-9 max-sm:px-3 max-sm:py-1.5 max-sm:text-xs max-sm:rounded-lg',
        sm: 'min-h-9 px-3 py-1 text-xs rounded-lg',
        lg: 'min-h-12 px-5 py-2.5 text-base rounded-xl',
        icon: 'size-10 min-h-10 p-0 rounded-xl max-sm:size-9 max-sm:min-h-9 max-sm:rounded-lg',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
