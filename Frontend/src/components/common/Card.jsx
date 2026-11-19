import clsx from 'clsx';

export default function Card({ title, subtitle, actions, className, bodyClassName, children }) {
  return (
    <section className={clsx('neu-card animate-fade-in', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
          <div>
            {title && <h2 className="text-[1rem] font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={clsx('p-5', bodyClassName)}>{children}</div>
    </section>
  );
}
