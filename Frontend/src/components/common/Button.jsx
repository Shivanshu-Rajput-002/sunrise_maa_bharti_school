import clsx from 'clsx';
import { Loader2 } from 'lucide-react';

const variants = {
  // Raised neumorphic button; pressed look on click
  neu: 'bg-base text-ink shadow-neu-sm hover:text-primary active:shadow-neu-in-sm',
  primary: 'bg-primary text-white shadow-neu-sm hover:brightness-110 active:shadow-neu-in-sm',
  danger: 'bg-base text-danger shadow-neu-sm hover:bg-danger hover:text-white active:shadow-neu-in-sm',
  ghost: 'bg-transparent text-muted hover:text-ink',
};

const sizes = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
  icon: 'h-10 w-10 justify-center',
  'icon-sm': 'h-8 w-8 justify-center',
};

export default function Button({
  variant = 'neu',
  size = 'md',
  loading = false,
  icon: Icon,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex shrink-0 items-center rounded-xl font-medium transition-all duration-150',
        'disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}
