import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function ManagementHeading({
  title,
  period,
  action,
}: {
  title: string;
  period?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {period && <p className="mt-1 text-sm text-muted-foreground">{period}</p>}
      </div>
      {action}
    </div>
  );
}
export function ManagementMetrics({
  items,
}: {
  items: { label: string; value: string; href?: string; emphasis?: boolean }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item) => {
        const content = (
          <>
            <span className="text-xs font-semibold text-muted-foreground whitespace-pre-line leading-snug sm:text-sm min-h-[2.5rem] flex flex-col justify-start">
              {item.label}
            </span>
            <strong className="mt-2 block break-words text-lg font-bold tabular-nums sm:text-2xl">
              {item.value}
            </strong>
          </>
        );
        const className = cn(
          'min-w-0 rounded-2xl border border-border bg-card p-4 transition-all',
          item.emphasis && 'border-primary/25 bg-primary/5 text-primary',
        );
        return item.href ? (
          <Link
            key={item.label}
            href={item.href}
            className={cn(className, 'hover:border-primary/40')}
          >
            {content}
          </Link>
        ) : (
          <div key={item.label} className={className}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
export function ManagementLink({
  href,
  title,
  detail,
}: {
  href: string;
  title: string;
  detail?: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-14 items-center justify-between gap-3 rounded-xl px-3 py-3 hover:bg-muted"
    >
      <span className="min-w-0">
        <strong className="block text-sm font-semibold">{title}</strong>
        {detail && <span className="mt-1 block text-xs text-muted-foreground">{detail}</span>}
      </span>
      <ChevronRight size={18} className="shrink-0 text-muted-foreground" />
    </Link>
  );
}
