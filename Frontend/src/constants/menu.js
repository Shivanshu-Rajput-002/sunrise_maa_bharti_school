import {
  ArrowUpCircle,
  BookOpen,
  BookOpenCheck,
  Bus,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  FileBarChart,
  GraduationCap,
  IndianRupee,
  LayoutDashboard,
  Layers,
  ListChecks,
  ListOrdered,
  Megaphone,
  NotebookPen,
  Receipt,
  ScrollText,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Trophy,
  UserPlus,
  Users,
  UsersRound,
  Wallet,
} from 'lucide-react';

/**
 * Sidebar menu. Items are shown only if the user has `permission`.
 * The backend enforces the same permissions on every API call.
 */
export const MENU = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, permission: 'dashboard.view' },
  {
    section: 'Students',
    items: [
      { label: 'All Students', path: '/students', icon: UsersRound, permission: 'students.view', end: true },
      { label: 'New Admission', path: '/students/new', icon: UserPlus, permission: 'students.create' },
      { label: 'Roll Numbers', path: '/students/roll-numbers', icon: ListOrdered, permission: 'students.update' },
      { label: 'Promotion', path: '/students/promotion', icon: ArrowUpCircle, permission: 'students.promote' },
      { label: 'Certificates', path: '/students/certificates', icon: ScrollText, permission: 'students.certificates' },
    ],
  },
  {
    section: 'Fees',
    items: [
      { label: 'Collect Fees', path: '/fees/collect', icon: IndianRupee, permission: 'fees.collect' },
      { label: 'Receipts', path: '/fees/receipts', icon: Receipt, permission: 'fees.view' },
      { label: 'Dues', path: '/fees/dues', icon: ListChecks, permission: 'fees.view' },
      { label: 'Fee Setup', path: '/fees/setup', icon: SlidersHorizontal, permission: 'fees.view' },
      { label: 'Cashbook', path: '/cashbook', icon: Wallet, permission: 'cashbook.view' },
    ],
  },
  {
    section: 'Attendance',
    items: [
      { label: 'Mark Attendance', path: '/attendance/mark', icon: CalendarCheck, permission: 'attendance.view' },
      { label: 'Register', path: '/attendance/register', icon: ClipboardList, permission: 'attendance.view' },
      { label: 'Holidays & Devices', path: '/attendance/settings', icon: CalendarDays, permission: 'attendance.view' },
    ],
  },
  {
    section: 'Exams',
    items: [
      { label: 'Exams & Timetable', path: '/exams', icon: BookOpenCheck, permission: 'exams.view', end: true },
      { label: 'Marks Entry', path: '/exams/marks', icon: NotebookPen, permission: 'exams.view' },
      { label: 'Results', path: '/exams/results', icon: Trophy, permission: 'exams.view' },
    ],
  },
  {
    section: 'School',
    items: [
      { label: 'Notices', path: '/notices', icon: Megaphone, permission: 'communication.view' },
      { label: 'Transport', path: '/transport', icon: Bus, permission: 'transport.view' },
      { label: 'Reports', path: '/reports', icon: FileBarChart, permission: 'reports.view' },
    ],
  },
  {
    section: 'Academic',
    items: [
      { label: 'Sessions', path: '/academic/sessions', icon: CalendarRange, permission: 'academic.view' },
      { label: 'Classes & Sections', path: '/academic/classes', icon: Layers, permission: 'academic.view' },
      { label: 'Subjects', path: '/academic/subjects', icon: BookOpen, permission: 'academic.view' },
    ],
  },
  {
    section: 'Administration',
    items: [
      { label: 'Users', path: '/admin/users', icon: Users, permission: 'users.view' },
      { label: 'Roles & Permissions', path: '/admin/roles', icon: ShieldCheck, permission: 'roles.view' },
      { label: 'Settings', path: '/admin/settings', icon: Settings, permission: 'settings.view' },
    ],
  },
];

/** Where a user lands after login: staff → dashboard, parents → portal */
export const homePath = (perms = []) => (perms.includes('dashboard.view') ? '/dashboard' : perms.includes('portal.view') ? '/portal' : '/dashboard');

export const APP_NAME = import.meta.env.VITE_APP_NAME || 'School ERP';
export const APP_SHORT = 'Sunrise ERP';
export const BrandIcon = GraduationCap;
