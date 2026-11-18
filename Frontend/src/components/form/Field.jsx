import clsx from 'clsx';
import { useId } from 'react';

/** Label + control + error/hint wrapper. Children receive the generated id. */
export default function Field({ label, error, hint, required, className, children }) {
  const id = useId();
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-muted">
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </label>
      )}
      {children(id)}
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted">{hint}</p>
      )}
    </div>
  );
}
