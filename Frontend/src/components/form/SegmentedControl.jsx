import clsx from 'clsx';

/** Neumorphic segmented switch — used for the Hindi / English / All medium toggle */
export default function SegmentedControl({ value, onChange, options, size = 'md', ariaLabel }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex rounded-xl bg-base p-1 shadow-neu-in-sm">
      {options.map((o) => {
        const active = String(o.value) === String(value);
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={clsx(
              'rounded-lg font-medium transition-all',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
              active ? 'bg-base text-primary shadow-neu-sm' : 'text-muted hover:text-ink',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
