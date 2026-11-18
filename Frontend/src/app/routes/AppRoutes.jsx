import { lazy, Suspense } from 'react';
import { useSelector } from 'react-redux';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import Loader from '../../components/common/Loader';
import AdminLayout from '../../components/layout/AdminLayout';
import ParentLayout from '../../components/layout/ParentLayout';
import { homePath } from '../../constants/menu';
import { selectPermissions } from '../../store/slices/authSlice';
import ProtectedRoute from './ProtectedRoute';
import RequirePermission from './RequirePermission';

// Route-level code splitting: each module loads only when opened
const LoginPage = lazy(() => import('../../modules/auth/pages/LoginPage'));
const DashboardPage = lazy(() => import('../../modules/dashboard/pages/DashboardPage'));
const SessionsPage = lazy(() => import('../../modules/academic/pages/SessionsPage'));
const ClassesPage = lazy(() => import('../../modules/academic/pages/ClassesPage'));
const SubjectsPage = lazy(() => import('../../modules/academic/pages/SubjectsPage'));
const UsersPage = lazy(() => import('../../modules/admin/pages/UsersPage'));
const RolesPage = lazy(() => import('../../modules/admin/pages/RolesPage'));
const SettingsPage = lazy(() => import('../../modules/admin/pages/SettingsPage'));
const StudentsListPage = lazy(() => import('../../modules/students/pages/StudentsListPage'));
const StudentFormPage = lazy(() => import('../../modules/students/pages/StudentFormPage'));
const StudentProfilePage = lazy(() => import('../../modules/students/pages/StudentProfilePage'));
const StudentImportPage = lazy(() => import('../../modules/students/pages/StudentImportPage'));
const RollNumbersPage = lazy(() => import('../../modules/students/pages/RollNumbersPage'));
const PromotionPage = lazy(() => import('../../modules/students/pages/PromotionPage'));
const CertificatesPage = lazy(() => import('../../modules/students/pages/CertificatesPage'));
const CollectFeePage = lazy(() => import('../../modules/fees/pages/CollectFeePage'));
const PaymentsPage = lazy(() => import('../../modules/fees/pages/PaymentsPage'));
const DuesPage = lazy(() => import('../../modules/fees/pages/DuesPage'));
const FeeSetupPage = lazy(() => import('../../modules/fees/pages/FeeSetupPage'));
const CashbookPage = lazy(() => import('../../modules/fees/pages/CashbookPage'));
const MarkAttendancePage = lazy(() => import('../../modules/attendance/pages/MarkAttendancePage'));
const AttendanceRegisterPage = lazy(() => import('../../modules/attendance/pages/AttendanceRegisterPage'));
const AttendanceSettingsPage = lazy(() => import('../../modules/attendance/pages/AttendanceSettingsPage'));
const ExamsPage = lazy(() => import('../../modules/exams/pages/ExamsPage'));
const MarksEntryPage = lazy(() => import('../../modules/exams/pages/MarksEntryPage'));
const ResultsPage = lazy(() => import('../../modules/exams/pages/ResultsPage'));
const NoticesPage = lazy(() => import('../../modules/communication/pages/NoticesPage'));
const TransportPage = lazy(() => import('../../modules/transport/pages/TransportPage'));
const ReportsPage = lazy(() => import('../../modules/reports/pages/ReportsPage'));
const PortalHomePage = lazy(() => import('../../modules/portal/pages/PortalHomePage'));
const PortalFeesPage = lazy(() => import('../../modules/portal/pages/PortalFeesPage'));
const PortalDuesPage = lazy(() => import('../../modules/portal/pages/PortalDuesPage'));
const PortalBusPage = lazy(() => import('../../modules/portal/pages/PortalBusPage'));
const PortalTestsPage = lazy(() => import('../../modules/portal/pages/PortalTestsPage'));
const PortalReportCardPage = lazy(() => import('../../modules/portal/pages/PortalReportCardPage'));
const PortalAttendancePage = lazy(() => import('../../modules/portal/pages/PortalAttendancePage'));
const PortalNoticesPage = lazy(() => import('../../modules/portal/pages/PortalNoticesPage'));

const guard = (permission, element) => <RequirePermission permission={permission}>{element}</RequirePermission>;

function NotFound() {
  const perms = useSelector(selectPermissions);
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="text-6xl font-bold text-primary">404</p>
      <p className="mt-2 text-muted">This page does not exist.</p>
      <Link to={homePath(perms)} className="mt-4 text-sm font-medium text-primary">Go home</Link>
    </div>
  );
}

/** Sends each role to its own home (parents → portal) */
function Home() {
  const perms = useSelector(selectPermissions);
  return <Navigate to={homePath(perms)} replace />;
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<Loader fullScreen />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/portal" element={guard('portal.view', <ParentLayout />)}>
            <Route index element={<PortalHomePage />} />
            <Route path="fees" element={<PortalFeesPage />} />
            <Route path="dues" element={<PortalDuesPage />} />
            <Route path="bus" element={<PortalBusPage />} />
            <Route path="tests" element={<PortalTestsPage />} />
            <Route path="report-cards" element={<PortalReportCardPage />} />
            <Route path="attendance" element={<PortalAttendancePage />} />
            <Route path="notifications" element={<PortalNoticesPage />} />
            <Route path="*" element={<Navigate to="/portal" replace />} />
          </Route>

          <Route element={<AdminLayout />}>
            <Route path="/dashboard" element={guard('dashboard.view', <DashboardPage />)} />

            <Route path="/students" element={guard('students.view', <StudentsListPage />)} />
            <Route path="/students/new" element={guard('students.create', <StudentFormPage />)} />
            <Route path="/students/import" element={guard('students.import', <StudentImportPage />)} />
            <Route path="/students/roll-numbers" element={guard('students.update', <RollNumbersPage />)} />
            <Route path="/students/promotion" element={guard('students.promote', <PromotionPage />)} />
            <Route path="/students/certificates" element={guard('students.certificates', <CertificatesPage />)} />
            <Route path="/students/:id" element={guard('students.view', <StudentProfilePage />)} />
            <Route path="/students/:id/edit" element={guard('students.update', <StudentFormPage key="edit" />)} />

            <Route path="/fees/collect" element={guard('fees.collect', <CollectFeePage />)} />
            <Route path="/fees/receipts" element={guard('fees.view', <PaymentsPage />)} />
            <Route path="/fees/dues" element={guard('fees.view', <DuesPage />)} />
            <Route path="/fees/setup" element={guard('fees.view', <FeeSetupPage />)} />
            <Route path="/cashbook" element={guard('cashbook.view', <CashbookPage />)} />

            <Route path="/attendance/mark" element={guard('attendance.view', <MarkAttendancePage />)} />
            <Route path="/attendance/register" element={guard('attendance.view', <AttendanceRegisterPage />)} />
            <Route path="/attendance/settings" element={guard('attendance.view', <AttendanceSettingsPage />)} />

            <Route path="/exams" element={guard('exams.view', <ExamsPage />)} />
            <Route path="/exams/marks" element={guard('exams.view', <MarksEntryPage />)} />
            <Route path="/exams/results" element={guard('exams.view', <ResultsPage />)} />

            <Route path="/notices" element={guard('communication.view', <NoticesPage />)} />
            <Route path="/transport" element={guard('transport.view', <TransportPage />)} />
            <Route path="/reports" element={guard('reports.view', <ReportsPage />)} />

            <Route path="/academic/sessions" element={guard('academic.view', <SessionsPage />)} />
            <Route path="/academic/classes" element={guard('academic.view', <ClassesPage />)} />
            <Route path="/academic/subjects" element={guard('academic.view', <SubjectsPage />)} />

            <Route path="/admin/users" element={guard('users.view', <UsersPage />)} />
            <Route path="/admin/roles" element={guard('roles.view', <RolesPage />)} />
            <Route path="/admin/settings" element={guard('settings.view', <SettingsPage />)} />

            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="/" element={<Home />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
