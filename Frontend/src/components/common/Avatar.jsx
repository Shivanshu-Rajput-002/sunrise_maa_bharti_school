import clsx from 'clsx';

const sizes = {
  xs: 'h-7 w-7 text-[10px] rounded-lg',
  sm: 'h-9 w-9 text-xs',
  md: 'h-12 w-12 text-sm',
  lg: 'h-24 w-24 text-2xl',
  xl: 'h-28 w-28 text-3xl sm:h-32 sm:w-32',
};

/** Photo if available, otherwise initials */
export default function Avatar({ name = '', photoPath, size = 'sm', className }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <span className={clsx('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-base font-semibold text-primary shadow-neu-sm', sizes[size], className)}>
      {photoPath ? <img src={`/uploads/${photoPath}`} alt={name} className="h-full w-full object-cover" loading="lazy" /> : initials || '?'}
    </span>
  );
}
