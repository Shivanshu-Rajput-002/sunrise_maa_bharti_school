import { FileText, IdCard } from 'lucide-react';
import { useGetChildExamsQuery, useGetChildResultsQuery } from '../../../api/opsApi';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import Loader from '../../../components/common/Loader';
import { openPdf } from '../../../utils/files';
import { formatDate } from '../../../utils/format';
import { Empty, PortalTitle, RequireEnrollment } from '../components/PortalShared';

const markText = (c) => (!c ? null : c.absent ? 'AB' : c.marks == null ? null : `${c.marks}/${c.max}`);

function Tests({ child }) {
  const { data: exams = [], isLoading } = useGetChildExamsQuery(child.id);
  const { data: results } = useGetChildResultsQuery(child.id);
  if (isLoading) return <Loader />;
  const resultBy = new Map((results?.exams ?? []).map((e) => [e.id, e]));

  // Upcoming = any paper today or later (or no dates yet); previous = all papers done
  const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  const lastDay = (e) => e.endDate ?? e.schedules.map((s) => s.examDate).filter(Boolean).sort().pop() ?? null;
  const upcoming = exams.filter((e) => !lastDay(e) || lastDay(e) >= today);
  const previous = exams.filter((e) => lastDay(e) && lastDay(e) < today).reverse();

  const card = (e) => {
    const r = resultBy.get(e.id);
    return (
      <Card
        key={e.id}
        title={e.name}
        subtitle={e.startDate ? `${formatDate(e.startDate)} – ${formatDate(e.endDate)}` : undefined}
        actions={
          <>
            {r?.percent != null && <Badge tone="success">{r.percent}%</Badge>}
            {e.isPublished && (
              <Button size="sm" icon={FileText} onClick={() => openPdf(`/portal/children/${child.id}/test-marksheet/${e.id}/pdf`, undefined, `${e.name} report card · ${child.name}`)}>
                Report card
              </Button>
            )}
            {e.admitCardVisible && (
              <Button size="sm" icon={IdCard} onClick={() => openPdf(`/portal/children/${child.id}/admit-card/${e.id}/pdf`, undefined, `${e.name} admit card · ${child.name}`)}>
                Admit card
              </Button>
            )}
          </>
        }
      >
        <ul className="space-y-2">
          {e.schedules.map((s) => {
            const m = markText(r?.cells[s.subjectId]);
            return (
              <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-sm shadow-neu-in-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{s.subject?.name}</span>
                  <span className="block text-xs text-muted">
                    {formatDate(s.examDate)}
                    {s.startTime ? ` · ${s.startTime.slice(0, 5)}–${s.endTime?.slice(0, 5) ?? ''}` : ''}
                  </span>
                </span>
                <span className="shrink-0 text-right tabular-nums">
                  {m ? <span className="font-semibold">{m}</span> : <span className="text-xs text-muted">Max {Number(s.maxMarks) + (s.practicalMax != null ? Number(s.practicalMax) : 0)}</span>}
                </span>
              </li>
            );
          })}
        </ul>
        {!e.isPublished && <p className="mt-3 text-xs text-muted">Marks and the report card appear once the school publishes the result.</p>}
        {!e.admitCardVisible && lastDay(e) && lastDay(e) >= today && <p className="mt-1 text-xs text-muted">The admit card will be available when the school releases it.</p>}
      </Card>
    );
  };

  return (
    <>
      <PortalTitle title="Class Tests" subtitle={`${child.name} · upcoming and previous tests`} />
      {!exams.length ? (
        <Card>
          <Empty>No tests scheduled yet.</Empty>
        </Card>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Upcoming tests ({upcoming.length})</h2>
            {upcoming.length ? <div className="grid gap-5 sm:gap-6 xl:grid-cols-2">{upcoming.map(card)}</div> : <Card><Empty>No upcoming tests.</Empty></Card>}
          </section>
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Previous tests ({previous.length})</h2>
            {previous.length ? <div className="grid gap-5 sm:gap-6 xl:grid-cols-2">{previous.map(card)}</div> : <Card><Empty>No previous tests yet.</Empty></Card>}
          </section>
        </div>
      )}
    </>
  );
}

export default function PortalTestsPage() {
  return <RequireEnrollment>{(child) => <Tests key={child.id} child={child} />}</RequireEnrollment>;
}
