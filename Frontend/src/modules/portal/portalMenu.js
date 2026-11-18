import { Bell, Bus, CalendarCheck, ClipboardList, FileText, Hourglass, LayoutDashboard, Wallet } from 'lucide-react';

/** Parent portal navigation — same order as the old site, plus a home page */
export const PORTAL_MENU = [
  { path: '/portal', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { path: '/portal/fees', label: 'Fees Master', icon: Wallet },
  { path: '/portal/bus', label: 'Bus GPS', icon: Bus },
  { path: '/portal/dues', label: 'Fees Due / Overdue', icon: Hourglass },
  { path: '/portal/tests', label: 'Class Tests', icon: ClipboardList },
  { path: '/portal/report-cards', label: 'Report Cards', icon: FileText },
  { path: '/portal/attendance', label: 'Attendance Report', icon: CalendarCheck },
  { path: '/portal/notifications', label: 'Notifications', icon: Bell },
];
