import clsx from 'clsx';
import { ChevronsLeft, X } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { NavLink } from 'react-router-dom';
import { APP_SHORT, MENU } from '../../constants/menu';
import SchoolLogo from '../common/SchoolLogo';
import { hasPermission } from '../../hooks/usePermission';
import { selectPermissions, selectUser } from '../../store/slices/authSlice';
import { setMobileNav, toggleSidebar } from '../../store/slices/uiSlice';

function NavItem({ item, collapsed, onNavigate }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      end={item.end}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
          collapsed && 'justify-center px-0',
          isActive ? 'bg-base text-primary shadow-neu-in-sm' : 'text-muted hover:text-ink',
        )
      }
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </NavLink>
  );
}

export default function Sidebar() {
  const dispatch = useDispatch();
  const perms = useSelector(selectPermissions);
  const isSuperAdmin = useSelector(selectUser)?.role?.slug === 'super_admin';
  // superAdminOnly items are hidden from every other role
  const allowed = (i) => hasPermission(perms, i.permission) && (!i.superAdminOnly || isSuperAdmin);
  const { sidebarCollapsed, mobileNavOpen } = useSelector((s) => s.ui);
  const closeMobile = () => dispatch(setMobileNav(false));

  // Filter by permission; drop sections that end up empty
  const menu = MENU.map((entry) =>
    entry.section ? { ...entry, items: entry.items.filter(allowed) } : entry,
  ).filter((e) => (e.section ? e.items.length : hasPermission(perms, e.permission)));

  const render = (collapsed) => (
    <div className="flex h-full flex-col">
      <div className={clsx('flex items-center gap-3 px-4 py-5', collapsed && 'justify-center px-0')}>
        <SchoolLogo className={collapsed ? 'h-11 w-11' : 'h-12 w-12'} />
        {!collapsed && <span className="truncate text-[1rem] font-semibold">{APP_SHORT}</span>}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4" aria-label="Main">
        {menu.map((entry) =>
          entry.section ? (
            <div key={entry.section} className="pt-4">
              {!collapsed && (
                <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted/80">{entry.section}</p>
              )}
              <div className="space-y-1">
                {entry.items.map((item) => (
                  <NavItem key={item.path} item={item} collapsed={collapsed} onNavigate={closeMobile} />
                ))}
              </div>
            </div>
          ) : (
            <NavItem key={entry.path} item={entry} collapsed={collapsed} onNavigate={closeMobile} />
          ),
        )}
      </nav>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside
        className={clsx(
          'relative hidden shrink-0 transition-[width] duration-200 lg:block',
          sidebarCollapsed ? 'w-20' : 'w-64',
        )}
      >
        <div className="fixed inset-y-0 left-0 z-30 p-3" style={{ width: sidebarCollapsed ? 80 : 256 }}>
          <div className="neu-card h-full">{render(sidebarCollapsed)}</div>
          <button
            onClick={() => dispatch(toggleSidebar())}
            className="absolute -right-1 top-8 flex h-7 w-7 items-center justify-center rounded-full bg-base text-muted shadow-neu-sm hover:text-primary"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronsLeft className={clsx('h-4 w-4 transition-transform', sidebarCollapsed && 'rotate-180')} />
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/30" onClick={closeMobile} aria-hidden />
          <div className="absolute inset-y-0 left-0 w-72 p-3 animate-fade-in">
            <div className="neu-card relative h-full">
              <button
                onClick={closeMobile}
                className="absolute right-3 top-5 flex h-8 w-8 items-center justify-center rounded-lg text-muted shadow-neu-sm"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
              {render(false)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
