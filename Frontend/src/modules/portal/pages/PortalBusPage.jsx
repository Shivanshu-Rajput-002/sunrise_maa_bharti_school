import { Bus, ExternalLink, MapPin, Phone } from 'lucide-react';
import { useGetPortalBusesQuery } from '../../../api/opsApi';
import Card from '../../../components/common/Card';
import Loader from '../../../components/common/Loader';
import { Empty, PortalTitle } from '../components/PortalShared';

export default function PortalBusPage() {
  const { data: buses = [], isLoading } = useGetPortalBusesQuery();
  if (isLoading) return <Loader />;

  return (
    <>
      <PortalTitle title="Bus GPS" subtitle="Live location of school buses" />
      {!buses.length ? (
        <Card>
          <Empty>Bus tracking is available only for students who use school transport.</Empty>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {buses.map((b) => (
            <section key={b.id} className="neu-card flex flex-col p-5">
              <div className="flex items-center gap-3">
                <span className="neu-inset flex h-12 w-12 shrink-0 items-center justify-center text-primary">
                  <Bus className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{b.busNo}</p>
                  <p className="truncate text-sm text-muted">{b.driverName || 'Driver not set'}</p>
                </div>
              </div>
              {b.stops && <p className="mt-3 text-xs leading-relaxed text-muted">{b.stops}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                {b.gpsUrl ? (
                  <a href={b.gpsUrl} target="_blank" rel="noreferrer noopener" className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white shadow-neu-sm">
                    <MapPin className="h-4 w-4" /> Track bus <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <span className="flex-1 rounded-xl px-4 py-2 text-center text-sm text-muted shadow-neu-in-sm">GPS link not available</span>
                )}
                {b.driverMobile && (
                  <a href={`tel:${b.driverMobile}`} className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-primary shadow-neu-sm">
                    <Phone className="h-4 w-4" /> {b.driverMobile}
                  </a>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
