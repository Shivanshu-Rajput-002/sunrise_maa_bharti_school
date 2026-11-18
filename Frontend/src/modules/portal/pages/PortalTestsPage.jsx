import { IdCard } from 'lucide-react';
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

  return (
    <>
      <PortalTitle title="Class Tests" subtitle={`${child.name} · timetable, admit cards and marks`} />
      {!exams.length ? (
        <Card>
          <Empty>No tests scheduled yet.</Empty>
        </Card>
      ) : (
        <div className="grid gap-5 sm:gap-6 xl:grid-cols-2">
          {exams.map((e) => {
            const r = resultBy.get(e.id);
            return (
              <Card
                key={e.id}
                title={e.name}
                subtitle={e.startDate ? `${formatDate(e.startDate)} – ${formatDate(e.endDate)}` : undefined}
                actions={
                  <>
                    {r?.percent != null && <Badge tone="success">{r.percent}%</Badge>}
                    <Button size="sm" icon={IdCard} onClick={() => openPdf(`/portal/children/${child.id}/admit-card/${e.id}/pdf`)}>
                      Admit card
                    </Button>
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
                          {m ? <span className="font-semibold">{m}</span> : <span className="text-xs text-muted">Max {Number(s.maxMarks)}</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {!r && <p className="mt-3 text-xs text-muted">Marks will appear here once the school publishes the result.</p>}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

export default function PortalTestsPage() {
  return <RequireEnrollment>{(child) => <Tests key={child.id} child={child} />}</RequireEnrollment>;
}
