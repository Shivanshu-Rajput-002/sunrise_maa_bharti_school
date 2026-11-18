import { ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import Card from '../../components/common/Card';
import { usePermission } from '../../hooks/usePermission';

export function Forbidden() {
  return (
    <Card className="mx-auto max-w-md text-center">
      <ShieldAlert className="mx-auto h-10 w-10 text-warning" />
      <h2 className="mt-3 text-lg font-semibold">Access denied</h2>
      <p className="mt-1 text-sm text-muted">Your role does not have permission to open this page.</p>
      <Link to="/dashboard" className="mt-4 inline-block text-sm font-medium text-primary">
        Back to dashboard
      </Link>
    </Card>
  );
}

/** UI-level guard. The backend enforces the same permission on every API call. */
export default function RequirePermission({ permission, children }) {
  return usePermission(permission) ? children : <Forbidden />;
}
