import { FileText } from 'lucide-react';
import { useGetChildResultsQuery } from '../../../api/opsApi';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import Loader from '../../../components/common/Loader';
import StatCard from '../../../components/common/StatCard';
import { openPdf } from '../../../utils/files';
import { Empty, PortalTitle, RequireEnrollment } from '../components/PortalShared';

function ReportCard({ child }) {
  const { data, isLoading, error } = useGetChildResultsQuery(child.id);
  if (isLoading) return <Loader />;
  if (error) return <p className="text-sm text-danger">{error.message}</p>;
  const has = data.exams.length > 0;

  return (
    <>
      <PortalTitle
        title="Report Cards"
        subtitle={`${child.name} · published results`}
        actions={has && <Button variant="primary" icon={FileText} onClick={() => openPdf(`/portal/children/${child.id}/report-card/pdf`, undefined, `Marksheet · ${child.name}`)}>View & print</Button>}
      />
      {!has ? (
        <Card>
          <Empty>No results published yet.</Empty>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Total marks" value={`${data.overall.total} / ${data.overall.max}`} />
            <StatCard label="Percentage" value={data.overall.percent != null ? `${data.overall.percent}%` : '—'} tone="success" />
            <StatCard label="Grade" value={data.overall.grade} tone="warning" />
          </div>

          <Card title="Subject-wise marks" className="mt-6">
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="w-full text-sm" style={{ minWidth: `${Math.max(360, 160 + data.exams.length * 110)}px` }}>
                <thead>
                  <tr className="text-xs uppercase text-muted">
                    <th className="sticky left-0 bg-base py-2 pr-3 text-left font-medium">Subject</th>
                    {data.exams.map((e) => (
                      <th key={e.id} className="px-2 text-right font-medium">{e.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.subjects.map((s) => (
                    <tr key={s.id} className="border-t border-line/60">
                      <td className="sticky left-0 bg-base py-2 pr-3">{s.name}</td>
                      {data.exams.map((e) => {
                        const c = e.cells[s.id];
                        return (
                          <td key={e.id} className="px-2 text-right tabular-nums">
                            {!c ? '—' : c.absent ? 'AB' : c.marks == null ? '' : `${c.marks}/${c.max}`}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr className="border-t-2 border-line font-semibold">
                    <td className="sticky left-0 bg-base py-2 pr-3">Total</td>
                    {data.exams.map((e) => (
                      <td key={e.id} className="px-2 text-right tabular-nums">{e.total}/{e.max}</td>
                    ))}
                  </tr>
                  <tr className="font-semibold">
                    <td className="sticky left-0 bg-base py-2 pr-3">Percentage</td>
                    {data.exams.map((e) => (
                      <td key={e.id} className="px-2 text-right tabular-nums">{e.percent != null ? `${e.percent}%` : '—'}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </>
  );
}

export default function PortalReportCardPage() {
  return <RequireEnrollment>{(child) => <ReportCard key={child.id} child={child} />}</RequireEnrollment>;
}
