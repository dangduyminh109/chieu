import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface TableColumn<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  hideWhenEmpty?: boolean;
}

/** Server-renderable table: format cells at the caller without serializing functions. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  emptyMessage = 'Chưa có dữ liệu.',
}: {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  caption: string;
  emptyMessage?: string;
}) {
  const visibleColumns = columns.filter(
    (column) => !column.hideWhenEmpty || rows.some((row) => column.cell(row) != null),
  );
  return (
    <div
      className="mt-6 overflow-x-auto rounded-xl border border-border"
      role="region"
      aria-label={caption}
      tabIndex={0}
    >
      <table className="responsive-table w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-muted">
          <tr>
            {visibleColumns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn('px-3 py-3 font-semibold whitespace-nowrap', column.className)}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.length ? (
            rows.map((row) => (
              <tr key={rowKey(row)} className="hover:bg-muted/40">
                {visibleColumns.map((column) => (
                  <td
                    key={column.key}
                    data-label={column.header}
                    data-empty={column.hideWhenEmpty && column.cell(row) == null ? true : undefined}
                    className={cn('px-3 py-3 align-top', column.className)}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={visibleColumns.length}
                className="px-4 py-12 text-center text-muted-foreground"
              >
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
