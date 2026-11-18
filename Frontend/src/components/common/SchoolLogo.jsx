import clsx from 'clsx';
import { useState } from 'react';
import { useGetSettingsQuery } from '../../api/opsApi';
import { BrandIcon } from '../../constants/menu';

/**
 * School logo from Settings (uploaded file); falls back to the default icon when no
 * logo is set or the image fails to load. Needs a logged-in user (settings API).
 */
export default function SchoolLogo({ className, iconClassName = 'h-5 w-5' }) {
  const { data } = useGetSettingsQuery();
  const [broken, setBroken] = useState(null);
  const path = data?.school?.logoPath;
  const name = data?.school?.name ?? 'School logo';

  return (
    <div className={clsx('neu-card flex shrink-0 items-center justify-center overflow-hidden rounded-xl text-primary', className)}>
      {path && broken !== path ? (
        <img src={`/uploads/${path}`} alt={name} className="h-full w-full bg-white object-contain p-0.5" onError={() => setBroken(path)} />
      ) : (
        <BrandIcon className={iconClassName} />
      )}
    </div>
  );
}
