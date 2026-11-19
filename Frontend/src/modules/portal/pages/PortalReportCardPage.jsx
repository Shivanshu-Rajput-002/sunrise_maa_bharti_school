import { FileText } from 'lucide-react';
import { useGetChildExamsQuery, useGetChildResultsQuery } from '../../../api/opsApi';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import Loader from '../../../components/common/Loader';
import { openPdf } from '../../../utils/files';
import { formatDate } from '../../../utils/format';
import { Empty, PortalTitle, RequireEnrollment } from '../components/PortalShared';

/** Test-wise report cards — only for results the school has published */
function ReportCards({ child }) {
  const { data: exams = [], isLoading } = useGetChildExamsQuery(child.id);
  const { data: results } = useGetChildResultsQuery(child.id);
  if (isLoading) return <Loader />;
  const resultBy = new Map((results?.exams ?? []).map((e) => [e.id, e]));
  const published = exams.filter((e) => e.isPublished).sort((a, b) => String(b.startDate ?? '').localeCompare(String(a.startDate ?? '')));

  return (
    <>
      <PortalTitle title="Report Cards" subtitle={`${child.name} · report card of each test, once the school publishes the result`} />
      {!published.length ? (
        <Card>
          <Empty>No results published yet.</Empty>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {published.map((e) => {
            const r = resultBy.get(e.id);
            return (
              <section key={e.id} className="neu-card flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-semibold">{e.name}</h2>
                    <p className="text-xs text-muted">{e.startDate ? `${formatDate(e.startDate)} – ${formatDate(e.endDate)}` : 'Result published'}</p>
                  </div>
                  {r?.percent != null && <Badge tone="success">{r.percent}%</Badge>}
                </div>
                {r && <p className="mt-3 text-sm text-muted">Total {r.total} / {r.max}</p>}
                <Button className="mt-4 justify-center" variant="primary" icon={FileText} onClick={() => openPdf(`/portal/children/${child.id}/test-marksheet/${e.id}/pdf`, undefined, `${e.name} report card · ${child.name}`)}>
                  View & print report card
                </Button>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

export default function PortalReportCardPage() {
  return <RequireEnrollment>{(child) => <ReportCards key={child.id} child={child} />}</RequireEnrollment>;
}
