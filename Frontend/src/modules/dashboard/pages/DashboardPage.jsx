import { AlertTriangle, BookOpen, CalendarCheck, CalendarRange, IndianRupee, Layers, Megaphone, RefreshCw, Rows3, UserPlus, Users, UsersRound } from 'lucide-react';
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
import { useGetDashboardQuery } from '../services/dashboardApi';

export default function DashboardPage() {
  const user = useSelector(selectUser);
  const { data, isLoading, isFetching, isError, error, refetch } = useGetDashboardQuery();
  const canAcademic = usePermission('academic.view');
  const canUsers = usePermission('users.view');
  const canStudents = usePermission('students.view');
  const canAdmit = usePermission('students.create');
  const canCollect = usePermission('fees.collect');
  const canAttendance = usePermission('attendance.mark');

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

  const { scope, counts, usersByRole, students, fees, attendance, notices } = data;
  const totalUsers = usersByRole.reduce((n, r) => n + r.count, 0);
  const boys = students?.byGender.male ?? 0;
  const girls = students?.byGender.female ?? 0;

  const quick = [
    { to: '/fees/collect', icon: IndianRupee, label: 'Collect fees', show: canCollect },
    { to: '/attendance/mark', icon: CalendarCheck, label: 'Attendance', show: canAttendance },
    { to: '/students/new', icon: UserPlus, label: 'New admission', show: canAdmit },
    { to: '/students', icon: UsersRound, label: 'Students', show: canStudents },
    { to: '/academic/classes', icon: Rows3, label: 'Classes & sections', show: canAcademic },
    { to: '/academic/sessions', icon: CalendarRange, label: 'Sessions', show: canAcademic },
    { to: '/academic/subjects', icon: BookOpen, label: 'Subjects', show: canAcademic },
    { to: '/admin/users', icon: Users, label: 'Users', show: canUsers },
  ].filter((q) => q.show);

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

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {students && <StatCard icon={UsersRound} label="Students" value={students.total} hint={`${boys} boys · ${girls} girls · ${students.newAdmissions} new`} />}
        {fees && <StatCard icon={IndianRupee} label="Collected today" value={formatMoney(fees.today)} hint={`Session total ${formatMoney(fees.session)}`} tone="success" />}
        {fees && <StatCard icon={AlertTriangle} label="Due till today" value={formatMoney(fees.dueTillDate)} hint={`${fees.defaulters} students with dues`} tone="danger" />}
        {attendance && (
          <StatCard
            icon={CalendarCheck}
            label="Attendance today"
            value={attendance.marked ? `${Math.round(((attendance.P + attendance.HD * 0.5) / attendance.marked) * 100)}%` : 'Not marked'}
            hint={attendance.marked ? `${attendance.P} present · ${attendance.A} absent · ${attendance.L} leave` : `${students?.total ?? ''} students`}
            tone="warning"
          />
        )}
        {!fees && <StatCard icon={Layers} label="Classes" value={counts.classes} hint={`${counts.sections} sections`} tone="warning" />}
        {!attendance && <StatCard icon={BookOpen} label="Subjects" value={counts.subjects} />}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {students ? (
          <Card title="Students per class" subtitle={`${students.total} enrolled`} className="lg:col-span-2">
            <ClassBarChart data={students.byClass} />
          </Card>
        ) : (
          <div className="lg:col-span-2" />
        )}

        <div className="space-y-6">
          <Card title="Quick actions">
            <div className="grid grid-cols-2 gap-3">
              {quick.map((q) => (
                <Link
                  key={q.to}
                  to={q.to}
                  className="flex flex-col items-center gap-2 rounded-2xl p-4 text-center text-xs font-medium shadow-neu-sm transition hover:text-primary active:shadow-neu-in-sm"
                >
                  <span className="neu-inset flex h-10 w-10 items-center justify-center text-primary">
                    <q.icon className="h-4 w-4" />
                  </span>
                  {q.label}
                </Link>
              ))}
            </div>
          </Card>

          {notices?.length > 0 && (
            <Card title="Notices">
              <ul className="space-y-3">
                {notices.slice(0, 4).map((n) => (
                  <li key={n.id} className="flex gap-3 text-sm">
                    <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span><span className="font-medium">{n.title}</span><span className="block text-xs text-muted">{formatDate(n.publishFrom)}</span></span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {usersByRole.length > 0 && <Card title="Staff & users" subtitle={`${totalUsers} active accounts`}>
            <ul className="space-y-2">
              {usersByRole.map((r) => (
                <li key={r.slug} className="flex items-center justify-between rounded-xl px-4 py-2 text-sm shadow-neu-in-sm">
                  <span>{r.role}</span>
                  <span className="font-semibold tabular-nums">{r.count}</span>
                </li>
              ))}
            </ul>
          </Card>}
        </div>
      </div>
    </>
  );
}
