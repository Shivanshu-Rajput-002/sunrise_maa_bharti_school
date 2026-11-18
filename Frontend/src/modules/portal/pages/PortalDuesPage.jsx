import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { useGetChildFeesQuery } from '../../../api/opsApi';
import Badge from '../../../components/common/Badge';
import Card from '../../../components/common/Card';
import Loader from '../../../components/common/Loader';
import StatCard from '../../../components/common/StatCard';
import { formatDate, formatMoney } from '../../../utils/format';
import { PortalTitle, RequireEnrollment } from '../components/PortalShared';

const daysLate = (d) => Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000));

function Dues({ child }) {
  const { data, isLoading, error } = useGetChildFeesQuery(child.id);
  if (isLoading) return <Loader />;
  if (error) return <p className="text-sm text-danger">{error.message}</p>;

  const pending = data.installments.filter((i) => i.totals.due > 0);
  const overdue = pending.filter((i) => i.overdue);
  const upcoming = pending.filter((i) => !i.overdue);
  const upcomingTotal = upcoming.reduce((n, i) => n + i.totals.due, 0);

  return (
    <>
      <PortalTitle title="Fees Due / Overdue" subtitle={`${child.name} · pending installments`} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={AlertTriangle} label="Overdue" value={formatMoney(data.totals.dueTillDate)} hint={`${overdue.length} installment(s)`} tone={overdue.length ? 'danger' : 'success'} />
        <StatCard icon={Clock} label="Upcoming" value={formatMoney(upcomingTotal)} hint={`${upcoming.length} installment(s)`} tone="warning" />
        <StatCard icon={CheckCircle2} label="Total balance" value={formatMoney(data.totals.due)} tone={data.totals.due > 0 ? 'primary' : 'success'} />
      </div>

      {!pending.length ? (
        <Card className="mt-6">
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-success" />
            <p className="font-semibold">All fees are paid</p>
            <p className="text-sm text-muted">Nothing is due for this session. Thank you!</p>
          </div>
        </Card>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {pending.map((i) => (
            <section key={i.id} className={clsx('neu-card p-5', i.overdue && 'ring-1 ring-danger/40')}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-semibold">{i.name}</h2>
                  <p className="text-xs text-muted">Due {formatDate(i.dueDate)}</p>
                </div>
                {i.overdue ? <Badge tone="danger">Overdue · {daysLate(i.dueDate)} days</Badge> : <Badge tone="warning">Upcoming</Badge>}
              </div>
              <p className={clsx('mt-4 text-2xl font-semibold tabular-nums', i.overdue ? 'text-danger' : 'text-ink')}>{formatMoney(i.totals.due)}</p>
              <ul className="mt-3 space-y-1 text-sm">
                {i.lines.filter((l) => l.due > 0).map((l) => (
                  <li key={`${l.feeHeadId}-${l.head}`} className="flex justify-between gap-2 text-muted">
                    <span className="truncate">{l.head}</span>
                    <span className="tabular-nums">{formatMoney(l.due)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {pending.length > 0 && (
        <p className="mt-6 text-sm text-muted">
          Please deposit the fees at the school office.
          {data.suggestedFine > 0 && ` A late fee of ${formatMoney(data.suggestedFine)} currently applies on overdue installments.`}
        </p>
      )}
    </>
  );
}

export default function PortalDuesPage() {
  return <RequireEnrollment>{(child) => <Dues key={child.id} child={child} />}</RequireEnrollment>;
}
