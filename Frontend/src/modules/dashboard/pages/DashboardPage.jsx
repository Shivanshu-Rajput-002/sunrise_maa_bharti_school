import { AlertTriangle, BookOpen, BriefcaseBusiness, CalendarCheck, Fingerprint, CalendarRange, IndianRupee, Layers, Megaphone, RefreshCw, Rows3, ScrollText, UserPlus, Users, UsersRound } from 'lucide-react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import Loader from '../../../components/common/Loader';
import PageHeader from '../../../components/common/PageHeader';
import StatCard from '../../../components/common/StatCard';
import { usePermission } from '../../../hooks/usePermission';
import { selectUser } from '../../../store/slices/authSlice';
import { formatDate, formatMoney } from '../../../utils/format';
import ClassBarChart from '../components/ClassBarChart';
import RecentActivity from '../components/RecentActivity';
import { useGetDashboardQuery } from '../services/dashboardApi';

const NOT_STAFF = ['parent', 'super_admin'];

export default function DashboardPage() {
  const user = useSelector(selectUser);
  const { data, isLoading, isFetching, isError, error, refetch } = useGetDashboardQuery();
  const canAcademic = usePermission('academic.view');
  const canUsers = usePermission('users.view');
  const canStudents = usePermission('students.view');
  const canAdmit = usePermission('students.create');
  const canCollect = usePermission('fees.collect');
  const canAttendance = usePermission('attendance.mark');
  const canCerts = usePermission('students.certificates');
  const canStaff = usePermission('staff.view');

  if (isLoading) return <Loader label="Loading dashboard…" />;
  if (isError)
    return (
      <Card title="Could not load dashboard">
        <p className="text-sm text-danger">{error?.message}</p>
        <Button className="mt-4" icon={RefreshCw} onClick={refetch}>
          Retry
        </Button>
      </Card>
    );

  const { scope, counts, usersByRole = [], students, fees, attendance, notices, recent = [], staffToday } = data;
  const totalUsers = usersByRole.reduce((n, r) => n + r.count, 0);
  // Prefer the server count; fall back to the role breakdown (older backend builds)
  const staff = counts.staff ?? (usersByRole.length ? usersByRole.filter((r) => !NOT_STAFF.includes(r.slug)).reduce((n, r) => n + r.count, 0) : null);
  const boys = students?.byGender.male ?? 0;
  const girls = students?.byGender.female ?? 0;
  const byClass = (students?.byClass ?? []).map((c) => ({ ...c, boys: c.boys ?? 0, girls: c.girls ?? 0 }));

  const quick = [
    { to: '/fees/collect', icon: IndianRupee, label: 'Collect fees', show: canCollect },
    { to: '/attendance/mark', icon: CalendarCheck, label: 'Attendance', show: canAttendance },
    { to: '/students/new', icon: UserPlus, label: 'New admission', show: canAdmit },
    { to: '/students', icon: UsersRound, label: 'Students', show: canStudents },
    { to: '/students/certificates', icon: ScrollText, label: 'Certificates', show: canCerts },
    { to: '/academic/classes', icon: Rows3, label: 'Classes', show: canAcademic },
    { to: '/academic/sessions', icon: CalendarRange, label: 'Sessions', show: canAcademic },
    { to: '/staff/attendance', icon: Fingerprint, label: 'Staff attendance', show: canStaff },
    { to: '/admin/users', icon: Users, label: 'Staff logins', show: canUsers && !canStaff },
  ].filter((q) => q.show);

  const attendancePct = attendance?.marked ? Math.round(((attendance.P + attendance.HD * 0.5) / attendance.marked) * 100) : null;

  return (
    <>
      <PageHeader
        title={`Hello, ${user?.name?.split(' ')[0] ?? ''}`}
        subtitle={`Session ${scope.session?.name} (${formatDate(scope.session?.startDate)} – ${formatDate(scope.session?.endDate)}) · ${
          scope.medium ? `${scope.medium.name} medium` : 'All mediums'
        }`}
        actions={
          <Button icon={RefreshCw} loading={isFetching} onClick={refetch}>
            Refresh
          </Button>
        }
      />

      {/* Row 1 — key numbers: 3 per row on laptops, one row on large screens */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {students && <StatCard icon={UsersRound} label="Total students" value={students.total} hint={`${boys} boys · ${girls} girls · ${students.newAdmissions} new`} />}
        <StatCard icon={BriefcaseBusiness} label="Total staff" value={staff ?? '—'} hint="Active staff" tone="primary" />
        {staffToday && (
          <StatCard
            icon={Fingerprint}
            label="Staff present today"
            value={staffToday.P + staffToday.HD + staffToday.A + staffToday.L ? `${staffToday.P + staffToday.HD} / ${staffToday.total}` : 'Not marked'}
            hint={`${staffToday.A} absent · ${staffToday.L} leave · ${staffToday.late} late`}
            tone="success"
          />
        )}
        {fees && <StatCard icon={IndianRupee} label="Collected today" value={formatMoney(fees.today)} hint={`Session total ${formatMoney(fees.session)}`} tone="success" />}
        {fees && <StatCard icon={AlertTriangle} label="Due till today" value={formatMoney(fees.dueTillDate)} hint={`${fees.defaulters} students with dues`} tone="danger" />}
        {attendance && (
          <StatCard
            icon={CalendarCheck}
            label="Students present today"
            value={attendancePct != null ? `${attendancePct}%` : 'Not marked'}
            hint={attendance.marked ? `${attendance.P} present · ${attendance.A} absent · ${attendance.L} leave` : `${students?.total ?? ''} students`}
            tone="warning"
          />
        )}
        {!fees && <StatCard icon={Layers} label="Classes" value={counts.classes} hint={`${counts.sections} sections`} tone="warning" />}
        {!attendance && <StatCard icon={BookOpen} label="Subjects" value={counts.subjects} />}
      </div>

      {/* Row 2 — chart + quick actions */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {students && (
          <Card title="Students per class" subtitle={`${students.total} enrolled · boys and girls`} className="min-w-0 lg:col-span-2">
            <ClassBarChart data={byClass} />
          </Card>
        )}
        <Card title="Quick actions" className={students ? 'min-w-0' : 'min-w-0 lg:col-span-3'}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
            {quick.map((q) => (
              <Link
                key={q.to}
                to={q.to}
                className="flex flex-col items-center gap-2 rounded-2xl p-3 text-center text-xs font-medium shadow-neu-sm transition hover:text-primary active:shadow-neu-in-sm"
              >
                <span className="neu-inset flex h-9 w-9 items-center justify-center text-primary">
                  <q.icon className="h-4 w-4" />
                </span>
                {q.label}
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {/* Row 3 — recent activity + notices / staff */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Recent activity" subtitle="Admissions, fee receipts and certificates" className="min-w-0 lg:col-span-2">
          <RecentActivity items={recent} />
        </Card>

        <div className="min-w-0 space-y-6">
          <Card title="Notices">
            {notices?.length ? (
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
          </Card>

          {usersByRole.length > 0 && (
            <Card title="Staff by role" subtitle={`${totalUsers} active accounts`}>
              <ul className="space-y-2">
                {usersByRole.map((r) => (
                  <li key={r.slug} className="flex items-center justify-between rounded-xl px-4 py-2 text-sm shadow-neu-in-sm">
                    <span>{r.role}</span>
                    <span className="font-semibold tabular-nums">{r.count}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
