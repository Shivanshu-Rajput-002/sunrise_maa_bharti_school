import { CalendarCheck, Hourglass, Megaphone, Trophy, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useGetChildAttendanceQuery, useGetChildFeesQuery, useGetChildResultsQuery, useGetPortalNoticesQuery } from '../../../api/opsApi';
import Avatar from '../../../components/common/Avatar';
import Badge from '../../../components/common/Badge';
import Card from '../../../components/common/Card';
import StatCard from '../../../components/common/StatCard';
import { formatDate, formatMoney } from '../../../utils/format';
import { classLabel, RequireEnrollment } from '../components/PortalShared';
import { PORTAL_MENU } from '../portalMenu';

function Detail({ label, value }) {
  return (
    <div className="min-w-0 rounded-xl px-3 py-2 shadow-neu-in-sm">
      <dt className="text-[11px] uppercase tracking-wide text-muted">{label}</dt>
      <dd className="truncate text-sm font-medium">{value || '—'}</dd>
    </div>
  );
}

function Overview({ child }) {
  const e = child.enrollment;
  const { data: fees } = useGetChildFeesQuery(child.id);
  const { data: att } = useGetChildAttendanceQuery(child.id);
  const { data: res } = useGetChildResultsQuery(child.id);
  const { data: notices = [] } = useGetPortalNoticesQuery();
  const pct = att?.totals.percent;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Profile */}
      <section className="neu-card flex flex-col items-center gap-5 p-5 text-center sm:flex-row sm:items-start sm:p-6 sm:text-left">
        <Avatar name={child.name} photoPath={child.photoPath} size="xl" className="rounded-2xl" />
        <div className="w-full min-w-0 flex-1">
          <h1 className="text-xl font-semibold sm:text-2xl">{child.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {classLabel(e)} · {e.medium?.name} medium
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-left md:grid-cols-3 xl:grid-cols-4">
            <Detail label="Admission no." value={child.admissionNo} />
            <Detail label="Roll no." value={e.rollNo} />
            <Detail label="Date of birth" value={child.dob ? formatDate(child.dob) : null} />
            <Detail label="Gender" value={child.gender ? child.gender[0].toUpperCase() + child.gender.slice(1) : null} />
          </dl>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Wallet} label="Fees paid" value={fees ? formatMoney(fees.totals.paid) : '…'} hint={fees ? `of ${formatMoney(fees.totals.payable)}` : undefined} tone="success" />
        <StatCard
          icon={Hourglass}
          label="Due till today"
          value={fees ? formatMoney(fees.totals.dueTillDate) : '…'}
          hint={fees?.overdueInstallments ? `${fees.overdueInstallments} installment(s) overdue` : 'No overdue installment'}
          tone={fees?.totals.dueTillDate > 0 ? 'danger' : 'success'}
        />
        <StatCard icon={CalendarCheck} label="Attendance" value={pct != null ? `${pct}%` : '—'} hint={att ? `${att.totals.P} present · ${att.totals.A} absent` : undefined} tone={pct != null && pct < 75 ? 'danger' : 'warning'} />
        <StatCard icon={Trophy} label="Result" value={res?.overall.percent != null ? `${res.overall.percent}%` : '—'} hint={res?.exams.length ? `Grade ${res.overall.grade}` : 'Not published yet'} />
      </div>

      <div className="grid gap-5 sm:gap-6 lg:grid-cols-3">
        <Card title="Quick links" className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {PORTAL_MENU.slice(1).map((m) => (
              <Link key={m.path} to={m.path} className="flex flex-col items-center gap-2 rounded-2xl p-3 text-center text-xs font-medium shadow-neu-sm transition hover:text-primary active:shadow-neu-in-sm sm:p-4">
                <span className="neu-inset flex h-10 w-10 items-center justify-center text-primary">
                  <m.icon className="h-4 w-4" />
                </span>
                {m.label}
              </Link>
            ))}
          </div>
        </Card>

        <Card title="Latest notices" actions={<Link to="/portal/notifications" className="text-xs font-medium text-primary">View all</Link>}>
          {notices.length ? (
            <ul className="space-y-3">
              {notices.slice(0, 4).map((n) => (
                <li key={n.id} className="flex gap-3 text-sm">
                  <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="block font-medium">{n.title}</span>
                    <span className="block text-xs text-muted">{formatDate(n.publishFrom)}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No notices right now.</p>
          )}
          {fees?.totals.dueTillDate > 0 && (
            <Link to="/portal/dues" className="mt-4 flex items-center justify-between rounded-xl px-3 py-2 text-sm shadow-neu-in-sm">
              <span>Pending fees</span>
              <Badge tone="danger">{formatMoney(fees.totals.dueTillDate)}</Badge>
            </Link>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function PortalHomePage() {
  return <RequireEnrollment>{(child) => <Overview key={child.id} child={child} />}</RequireEnrollment>;
}
