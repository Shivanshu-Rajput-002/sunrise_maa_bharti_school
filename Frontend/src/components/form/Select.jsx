import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';
import { forwardRef } from 'react';
import Field from './Field';

/** options: [{ value, label }] */
const Select = forwardRef(function Select(
  { label, error, hint, required, className, options = [], placeholder, ...props },
  ref,
) {
  return (
    <Field label={label} error={error} hint={hint} required={required} className={className}>
      {(id) => (
        <div className="relative">
          <select ref={ref} id={id} aria-invalid={!!error} className={clsx('neu-field appearance-none pr-10')} {...props}>
            {placeholder !== undefined && <option value="">{placeholder}</option>}
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        </div>
      )}
    </Field>
  );
});

export default Select;
