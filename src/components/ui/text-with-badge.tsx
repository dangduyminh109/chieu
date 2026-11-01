import type { ComponentProps, ReactNode } from 'react';
import { Badge, type BadgeVariant } from './badge';
import { cn } from '@/lib/utils';

export function TextWithBadge({
  text,
  badge,
  badgeVariant = 'secondary',
  className,
  textClassName,
  ...props
}: Omit<ComponentProps<'span'>, 'children'> & {
  text: ReactNode;
  badge?: ReactNode;
  badgeVariant?: BadgeVariant;
  textClassName?: string;
}) {
  return (
    <span
      data-slot="text-with-badge"
      className={cn('inline-flex min-w-0 flex-wrap items-center gap-2', className)}
      {...props}
    >
      <span className={cn('min-w-0', textClassName)}>{text}</span>
      {badge !== undefined && badge !== null && <Badge variant={badgeVariant}>{badge}</Badge>}
    </span>
  );
}
