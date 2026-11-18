import clsx from 'clsx';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import Button from './Button';

/**
 * columns: [{ key, header, render?(row), className? }]
 * meta (optional, server pagination): { page, totalPages, total }
 */
export default function DataTable({ columns, rows = [], loading, meta, onPageChange, rowKey = 'id', empty = 'No records found' }) {
  return (
    <div>
      <div className="neu-inset overflow-x-auto p-1">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-muted">
              {columns.map((c) => (
                <th key={c.key} className={clsx('px-4 py-3 font-medium', c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {columns.map((c) => (
                      <td key={c.key} className="px-4 py-3">
                        <div className="h-4 animate-pulse rounded bg-line" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row) => (
                  <tr key={row[rowKey]} className="border-t border-line/70 transition-colors hover:bg-primary/5">
                    {columns.map((c) => (
                      <td key={c.key} className={clsx('px-4 py-3 align-middle', c.className)}>
                        {c.render ? c.render(row) : (row[c.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-muted">
            <Inbox className="h-8 w-8" />
            <p className="text-sm">{empty}</p>
          </div>
        )}
      </div>

      {meta && meta.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted">
          <span>
            Page {meta.page} of {meta.totalPages} · {meta.total} records
          </span>
          <div className="flex gap-2">
            <Button size="icon-sm" icon={ChevronLeft} disabled={meta.page <= 1} onClick={() => onPageChange(meta.page - 1)} aria-label="Previous page" />
            <Button size="icon-sm" icon={ChevronRight} disabled={meta.page >= meta.totalPages} onClick={() => onPageChange(meta.page + 1)} aria-label="Next page" />
          </div>
        </div>
      )}
    </div>
  );
}
