import clsx from 'clsx';

/** Neumorphic toggle. Controlled: <Switch checked={v} onChange={setV} label="Active" /> */
export default function Switch({ checked, onChange, label, disabled }) {
  return (
    <label className={clsx('inline-flex cursor-pointer items-center gap-3 text-sm', disabled && 'opacity-50')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="relative h-7 w-12 rounded-full bg-base shadow-neu-in-sm transition"
      >
        <span
          className={clsx(
            'absolute top-1 h-5 w-5 rounded-full shadow-neu-sm transition-all duration-200',
            checked ? 'left-6 bg-primary' : 'left-1 bg-base',
          )}
        />
      </button>
      {label && <span className="text-ink">{label}</span>}
    </label>
  );
}
