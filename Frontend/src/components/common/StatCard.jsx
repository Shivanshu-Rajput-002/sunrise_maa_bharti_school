export default function StatCard({ icon: Icon, label, value, hint, tone = 'primary' }) {
  const tones = {
    primary: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
  };
  return (
    <div className="neu-card flex h-full items-center gap-3 p-4 animate-fade-in sm:gap-4 sm:p-5">
      {Icon && (
        <div className={`neu-inset flex h-10 w-10 shrink-0 items-center justify-center sm:h-12 sm:w-12 ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
        <p className="mt-0.5 truncate text-xl font-semibold tabular-nums text-ink sm:text-2xl">{value ?? '—'}</p>
        {hint && <p className="truncate text-xs text-muted">{hint}</p>}
      </div>
    </div>
  );
}
