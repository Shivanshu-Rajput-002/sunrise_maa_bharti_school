import { useOutletContext } from 'react-router-dom';
import Card from '../../../components/common/Card';

/** The child picked in the portal sidebar ({ child, children }) */
export const usePortalChild = () => useOutletContext();

export const classLabel = (e) => (e ? `Class ${e.schoolClass?.name}${e.section ? ` - ${e.section.name}` : ''}` : 'Not enrolled');

/** Pages that need an enrollment in the selected session render a notice instead */
export function RequireEnrollment({ children: render }) {
  const { child } = usePortalChild();
  if (!child?.enrollment)
    return (
      <Card title="Not enrolled in this session">
        <p className="text-sm text-muted">{child?.name} is not enrolled in the selected session. Pick another session from the top bar.</p>
      </Card>
    );
  return render(child);
}

export function PortalTitle({ title, subtitle, actions }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-6">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ children }) {
  return <p className="py-6 text-center text-sm text-muted">{children}</p>;
}
