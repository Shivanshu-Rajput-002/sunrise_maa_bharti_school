import clsx from 'clsx';

const tones = {
  neutral: 'text-muted',
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

export default function Badge({ tone = 'neutral', children, className }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full bg-base px-2.5 py-0.5 text-xs font-medium shadow-neu-in-sm',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
