import { Megaphone } from 'lucide-react';
import { useGetPortalNoticesQuery } from '../../../api/opsApi';
import Card from '../../../components/common/Card';
import Loader from '../../../components/common/Loader';
import { formatDate } from '../../../utils/format';
import { Empty, PortalTitle } from '../components/PortalShared';

export default function PortalNoticesPage() {
  const { data: notices = [], isLoading } = useGetPortalNoticesQuery();
  if (isLoading) return <Loader />;

  return (
    <>
      <PortalTitle title="Notifications" subtitle="Notices from the school" />
      {!notices.length ? (
        <Card>
          <Empty>No notices right now.</Empty>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {notices.map((n) => (
            <article key={n.id} className="neu-card flex gap-4 p-5">
              <span className="neu-inset flex h-10 w-10 shrink-0 items-center justify-center text-primary">
                <Megaphone className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h2 className="font-semibold">{n.title}</h2>
                <p className="text-xs text-muted">{formatDate(n.publishFrom)}</p>
                {n.body && <p className="mt-2 whitespace-pre-line break-words text-sm text-muted">{n.body}</p>}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
