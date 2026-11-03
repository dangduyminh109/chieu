import Link from 'next/link';
import { ChevronRight, House } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

/**
 * Consistent page header used across all workshop pages.
 * Renders a breadcrumb trail + a large heading line + optional description + optional action slot.
 */
export function PageHeader({
  title,
  description,
  icon: Icon,
  breadcrumbs,
  action,
}: {
  title: string;
  description?: string;
  /** Lucide icon component */
  icon?: ComponentType<{ className?: string; size?: number }>;
  /** Extra crumbs rendered between "Trang chủ" and the current page title */
  breadcrumbs?: BreadcrumbItem[];
  /** Button / link rendered on the right side of the heading row */
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 space-y-3 min-w-0">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="min-w-0">
        <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <li>
            <Link
              href="/"
              className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
              aria-label="Trang chủ"
            >
              <House size={12} />
              <span>Trang chủ</span>
            </Link>
          </li>

          {breadcrumbs?.map((crumb) => (
            <li key={crumb.label} className="flex items-center gap-1">
              <ChevronRight size={12} className="shrink-0 text-border" aria-hidden />
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-foreground transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-muted-foreground">{crumb.label}</span>
              )}
            </li>
          ))}

          <li className="flex items-center gap-1 min-w-0" aria-current="page">
            <ChevronRight size={12} className="shrink-0 text-border" aria-hidden />
            <span className="font-semibold text-foreground truncate">{title}</span>
          </li>
        </ol>
      </nav>

      {/* Heading Row */}
      <div className="flex flex-wrap items-start justify-between gap-3 min-w-0">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2.5 text-2xl font-black tracking-tight text-foreground sm:text-3xl min-w-0">
            {Icon && <Icon className="size-7 shrink-0 text-primary sm:size-8" />}
            <span className="break-words">{title}</span>
          </h1>
          {description && (
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm break-words">{description}</p>
          )}
        </div>
        {action && (
          <div className="shrink-0 max-sm:w-full max-sm:flex max-sm:justify-end">{action}</div>
        )}
      </div>
    </div>
  );
}
