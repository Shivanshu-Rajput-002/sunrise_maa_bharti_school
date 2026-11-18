import clsx from 'clsx';

/** Neumorphic tabs. tabs: [{ key, label }] */
export default function Tabs({ tabs, value, onChange, className }) {
  return (
    <div role="tablist" className={clsx('mb-6 inline-flex flex-wrap gap-1 rounded-2xl bg-base p-1.5 shadow-neu-in-sm', className)}>
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className={clsx(
            'rounded-xl px-4 py-2 text-sm font-medium transition-all',
            value === t.key ? 'bg-base text-primary shadow-neu-sm' : 'text-muted hover:text-ink',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
