import clsx from 'clsx';
import { useState } from 'react';

/**
 * Students per class — vertical stacked columns (boys + girls) with the class name under
 * each column and the total on top. Two validated series hues (--chart-1 boys, --chart-2
 * girls) with a 2px surface gap between segments, 4px rounded top, legend + direct totals,
 * per-column hover/focus tooltip. Class names and numbers are real text (table view).
 */
export default function ClassBarChart({ data }) {
  const [active, setActive] = useState(null);
  if (!data.length) return <p className="py-8 text-center text-sm text-muted">No students enrolled yet.</p>;

  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((n, d) => n + d.count, 0);
  // Nice round top for the axis (5, 10, 20, 50 …)
  const step = [1, 2, 5, 10, 20, 25, 50, 100, 200].find((s) => max / s <= 4) ?? 500;
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const H = 250; // plot height in px

  return (
    <div>
      {/* Legend: 2 series → always shown */}
      <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-chart" />Boys</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-chart2" />Girls</span>
        <span className="ml-auto">{total} students · {data.length} classes</span>
      </div>

      <div className="flex">
        {/* y axis */}
        <div className="relative mr-2 w-7 shrink-0 text-right text-[10px] tabular-nums text-muted" style={{ height: H }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ bottom: `${(t / top) * 100}%`, transform: 'translateY(50%)' }}>{t}</span>
          ))}
        </div>

        <div className="min-w-0 flex-1 overflow-x-auto pb-1">
          <div className="relative" style={{ minWidth: data.length * 40 }}>
            {/* recessive grid */}
            <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: H }}>
              {ticks.map((t) => (
                <span key={t} className={clsx('absolute inset-x-0 border-t', t === 0 ? 'border-line' : 'border-line/40')} style={{ bottom: `${(t / top) * 100}%` }} />
              ))}
            </div>

            <ul className="relative flex items-end gap-1.5 sm:gap-2" style={{ height: H }} role="list" aria-label="Students per class, boys and girls">
              {data.map((d) => {
                const isActive = active === d.classId;
                const boysH = (d.boys / top) * H;
                const girlsH = (d.girls / top) * H;
                const other = Math.max(0, d.count - d.boys - d.girls);
                const otherH = (other / top) * H;
                return (
                  <li
                    key={d.classId}
                    tabIndex={0}
                    onMouseEnter={() => setActive(d.classId)}
                    onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(d.classId)}
                    onBlur={() => setActive(null)}
                    className="group relative flex h-full flex-1 flex-col items-center justify-end outline-none"
                    aria-label={`Class ${d.name}: ${d.count} students, ${d.boys} boys, ${d.girls} girls`}
                  >
                    {/* total, direct label */}
                    <span className="mb-1 text-[11px] font-semibold tabular-nums text-ink">{d.count}</span>
                    <span
                      className="flex w-full max-w-[34px] flex-col-reverse gap-[2px] transition-opacity"
                      style={{ opacity: active && !isActive ? 0.45 : 1 }}
                    >
                      {d.boys > 0 && <span className={clsx('w-full bg-chart', !d.girls && !other && 'rounded-t-[4px]')} style={{ height: boysH }} />}
                      {d.girls > 0 && <span className={clsx('w-full bg-chart2', !other && 'rounded-t-[4px]')} style={{ height: girlsH }} />}
                      {other > 0 && <span className="w-full rounded-t-[4px] bg-muted/50" style={{ height: otherH }} />}
                    </span>

                    {isActive && (
                      <span
                        role="tooltip"
                        className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-base px-3 py-2 text-xs text-ink shadow-neu-sm"
                        // sits just above the column's total label
                        style={{ bottom: Math.min(H - 70, (d.count / top) * H + 22) }}
                      >
                        <span className="block font-semibold">Class {d.name}</span>
                        <span className="block tabular-nums">{d.count} students · {Math.round((d.count / total) * 100)}%</span>
                        <span className="mt-0.5 flex items-center gap-1.5 tabular-nums"><span className="h-2 w-2 rounded-sm bg-chart" />{d.boys} boys</span>
                        <span className="flex items-center gap-1.5 tabular-nums"><span className="h-2 w-2 rounded-sm bg-chart2" />{d.girls} girls</span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>

            {/* class names under the columns */}
            <div className="mt-2 flex gap-1.5 sm:gap-2">
              {data.map((d) => (
                <span key={d.classId} className={clsx('line-clamp-2 flex-1 break-words text-center text-[10px] leading-tight sm:text-[11px]', active === d.classId ? 'font-semibold text-ink' : 'text-muted')} title={d.name}>
                  {d.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
