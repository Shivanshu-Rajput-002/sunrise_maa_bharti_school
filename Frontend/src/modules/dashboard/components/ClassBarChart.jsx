import { useState } from 'react';

/**
 * Students per class — single-series horizontal bar chart (magnitude across categories).
 * One validated hue (--chart-1), thin bars, 4px rounded data end anchored at the baseline,
 * recessive axis, per-bar hover/focus tooltip. Single series → no legend; the card title names it.
 * Class labels and counts are real text, so the chart doubles as its own table view.
 */
export default function ClassBarChart({ data }) {
  const [active, setActive] = useState(null);
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((n, d) => n + d.count, 0);

  if (!data.length) return <p className="py-8 text-center text-sm text-muted">No students enrolled yet.</p>;

  return (
    <ul className="space-y-1.5" role="list" aria-label="Students per class">
      {data.map((d) => {
        const pct = (d.count / max) * 100;
        const isActive = active === d.classId;
        return (
          <li
            key={d.classId}
            tabIndex={0}
            onMouseEnter={() => setActive(d.classId)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(d.classId)}
            onBlur={() => setActive(null)}
            className="group relative grid grid-cols-[84px_1fr_36px] items-center gap-3 rounded-lg px-1 py-1 outline-none"
            aria-label={`Class ${d.name}: ${d.count} students`}
          >
            <span className="truncate text-xs text-muted">{d.name}</span>
            {/* track = baseline; bar grows from it */}
            <span className="relative h-3 border-l border-line">
              <span
                className="absolute inset-y-0 left-0 rounded-r-[4px] bg-chart transition-opacity"
                style={{ width: `${pct}%`, opacity: active && !isActive ? 0.45 : 1 }}
              />
            </span>
            <span className="text-right text-xs font-medium tabular-nums text-ink">{d.count}</span>

            {isActive && (
              <span
                role="tooltip"
                className="pointer-events-none absolute -top-9 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-base px-3 py-1.5 text-xs text-ink shadow-neu-sm"
                // track starts at 4px pad + 84px label + 12px gap = 100px; track width = 100% − 152px
                style={{ left: `clamp(110px, calc(100px + (100% - 152px) * ${pct / 100}), calc(100% - 110px))` }}
              >
                <span className="font-semibold">Class {d.name}</span> · {d.count} students · {Math.round((d.count / total) * 100)}%
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
