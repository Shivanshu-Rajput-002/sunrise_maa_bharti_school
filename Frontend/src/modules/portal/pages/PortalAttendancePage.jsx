import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useGetChildAttendanceQuery } from '../../../api/opsApi';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import Loader from '../../../components/common/Loader';
import StatCard from '../../../components/common/StatCard';
import { Empty, PortalTitle, RequireEnrollment } from '../components/PortalShared';

const monthName = (ym) => new Date(`${ym}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
const STATUS = {
  P: { label: 'Present', cls: 'bg-success/15 text-success' },
  A: { label: 'Absent', cls: 'bg-danger/15 text-danger' },
  L: { label: 'Leave', cls: 'bg-warning/15 text-warning' },
  HD: { label: 'Half day', cls: 'bg-primary/15 text-primary' },
};
const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** One month as a 7-column grid; each marked day shows its status letter (not colour alone) */
function MonthCalendar({ ym, byDate }) {
  const [y, m] = ym.split('-').map(Number);
  const first = new Date(y, m - 1, 1).getDay();
  const count = new Date(y, m, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  return (
    <div className="grid grid-cols-7 gap-1 sm:gap-2">
      {WEEK.map((d) => (
        <div key={d} className="pb-1 text-center text-[10px] font-semibold uppercase text-muted sm:text-xs">{d}</div>
      ))}
      {cells.map((d, i) => {
        if (!d) return <div key={`e${i}`} />;
        const date = `${ym}-${String(d).padStart(2, '0')}`;
        const st = byDate.get(date);
        return (
          <div
            key={date}
            title={st ? STATUS[st].label : undefined}
            className={clsx(
              'flex aspect-square flex-col items-center justify-center rounded-lg text-xs sm:rounded-xl sm:text-sm',
              st ? STATUS[st].cls : 'text-muted shadow-neu-in-sm',
            )}
          >
            <span className="tabular-nums">{d}</span>
            {st && <span className="text-[9px] font-bold leading-none sm:text-[10px]">{st}</span>}
          </div>
        );
      })}
    </div>
  );
}

function Attendance({ child }) {
  const { data, isLoading } = useGetChildAttendanceQuery(child.id);
  const months = data?.months ?? [];
  const [idx, setIdx] = useState(null);
  const byDate = useMemo(() => new Map((data?.days ?? []).map((d) => [String(d.date).slice(0, 10), d.status])), [data]);
  if (isLoading) return <Loader />;

  const t = data.totals;
  const i = idx ?? months.length - 1;
  const cur = months[i];

  return (
    <>
      <PortalTitle title="Attendance Report" subtitle={`${child.name} · this session`} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Attendance" value={t.percent != null ? `${t.percent}%` : '—'} hint={`${t.total} working days`} tone={t.percent != null && t.percent < 75 ? 'danger' : 'success'} />
        <StatCard label="Present" value={t.P + (t.HD ? ` + ${t.HD} half` : '')} tone="success" />
        <StatCard label="Absent" value={t.A} tone="danger" />
        <StatCard label="Leave" value={t.L} tone="warning" />
      </div>

      {!months.length ? (
        <Card className="mt-6">
          <Empty>No attendance recorded yet.</Empty>
        </Card>
      ) : (
        <div className="mt-6 grid gap-5 sm:gap-6 lg:grid-cols-5">
          <Card
            className="lg:col-span-3"
            title={monthName(cur.month)}
            subtitle={`${cur.P} present · ${cur.A} absent · ${cur.L} leave${cur.percent != null ? ` · ${cur.percent}%` : ''}`}
            actions={
              <>
                <Button size="icon-sm" icon={ChevronLeft} disabled={i <= 0} onClick={() => setIdx(i - 1)} aria-label="Previous month" />
                <Button size="icon-sm" icon={ChevronRight} disabled={i >= months.length - 1} onClick={() => setIdx(i + 1)} aria-label="Next month" />
              </>
            }
          >
            <MonthCalendar ym={cur.month} byDate={byDate} />
            <div className="mt-4 flex flex-wrap gap-3 text-xs">
              {Object.entries(STATUS).map(([k, v]) => (
                <span key={k} className="flex items-center gap-1.5">
                  <span className={clsx('flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold', v.cls)}>{k}</span>
                  {v.label}
                </span>
              ))}
            </div>
          </Card>

          <Card title="Month-wise summary" className="lg:col-span-2">
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="w-full min-w-[320px] text-sm">
                <thead>
                  <tr className="text-xs uppercase text-muted">
                    <th className="py-2 text-left font-medium">Month</th>
                    <th className="text-right font-medium">P</th>
                    <th className="text-right font-medium">A</th>
                    <th className="text-right font-medium">L</th>
                    <th className="text-right font-medium">%</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((m, k) => (
                    <tr key={m.month} onClick={() => setIdx(k)} className={clsx('cursor-pointer border-t border-line/60 hover:bg-primary/5', k === i && 'text-primary')}>
                      <td className="py-2">{monthName(m.month)}</td>
                      <td className="text-right tabular-nums">{m.P + m.HD * 0.5}</td>
                      <td className="text-right tabular-nums">{m.A}</td>
                      <td className="text-right tabular-nums">{m.L}</td>
                      <td className={clsx('text-right tabular-nums', m.percent < 75 && 'text-danger')}>{m.percent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

export default function PortalAttendancePage() {
  return <RequireEnrollment>{(child) => <Attendance key={child.id} child={child} />}</RequireEnrollment>;
}
