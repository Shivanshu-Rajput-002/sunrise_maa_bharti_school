import clsx from 'clsx';
import { Eye, EyeOff } from 'lucide-react';
import { forwardRef, useState } from 'react';
import Field from './Field';

/** Works with react-hook-form: <Input label="Name" {...register('name')} error={errors.name?.message} /> */
const Input = forwardRef(function Input(
  { label, error, hint, required, className, icon: Icon, type = 'text', ...props },
  ref,
) {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';

  return (
    <Field label={label} error={error} hint={hint} required={required} className={className}>
      {(id) => (
        <div className="relative">
          {Icon && <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />}
          <input
            ref={ref}
            id={id}
            type={isPassword && show ? 'text' : type}
            aria-invalid={!!error}
            className={clsx('neu-field', Icon && 'pl-10', isPassword && 'pr-10', error && 'text-danger')}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
              aria-label={show ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          )}
        </div>
      )}
    </Field>
  );
});

export default Input;
