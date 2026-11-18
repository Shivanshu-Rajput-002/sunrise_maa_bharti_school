import clsx from 'clsx';
import { CalendarRange, Check, LogOut, Menu, Moon, Sun, X } from 'lucide-react';
import { Suspense, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useGetChildrenQuery } from '../../api/opsApi';
import { APP_SHORT } from '../../constants/menu';
import SchoolLogo from '../common/SchoolLogo';
import { useGetSessionsQuery } from '../../modules/academic/services/academicApi';
import { useLogoutMutation } from '../../modules/auth/services/authApi';
import { classLabel } from '../../modules/portal/components/PortalShared';
import { PORTAL_MENU } from '../../modules/portal/portalMenu';
import { selectUser, setGuest } from '../../store/slices/authSlice';
import { selectScope, setSession } from '../../store/slices/scopeSlice';
import { setMobileNav, toggleTheme } from '../../store/slices/uiSlice';
import { storage } from '../../utils/storage';
import Avatar from '../common/Avatar';
import Card from '../common/Card';
import Loader from '../common/Loader';

/**
 * Parent portal shell: sidebar (fixed on desktop, drawer on phone/tablet) with the
 * selected child's photo, child switcher and the portal links. The chosen child is
 * handed to every page through the Outlet context.
 */
export default function ParentLayout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSelector(selectUser);
  const theme = useSelector((s) => s.ui.theme);
  const mobileNavOpen = useSelector((s) => s.ui.mobileNavOpen);
  const { sessionId } = useSelector(selectScope);
  const { data: sessions = [] } = useGetSessionsQuery();
  const { data: children = [], isLoading } = useGetChildrenQuery();
  const [logout] = useLogoutMutation();
  const [childId, setChildId] = useState(() => Number(storage.get('portalChild')) || null);

  const child = useMemo(() => children.find((c) => c.id === childId) ?? children[0] ?? null, [children, childId]);
  const closeMobile = () => dispatch(setMobileNav(false));

  // Close the drawer whenever the page changes
  useEffect(() => {
    dispatch(setMobileNav(false));
  }, [location.pathname, dispatch]);

  const pickChild = (id) => {
    setChildId(id);
    storage.set('portalChild', id);
  };

  const onLogout = async () => {
    try {
      await logout().unwrap();
    } finally {
      dispatch(setGuest());
      navigate('/login', { replace: true });
    }
  };

  const current = PORTAL_MENU.find((m) => (m.end ? location.pathname === m.path : location.pathname.startsWith(m.path)));

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-4 pb-3 pt-5">
        <SchoolLogo className="h-12 w-12" />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-base font-semibold">{APP_SHORT}</p>
          <p className="text-[11px] text-muted">Parent portal</p>
        </div>
      </div>

      {/* Selected child */}
      {child && (
        <div className="mx-3 mt-2 flex flex-col items-center rounded-2xl px-3 py-4 text-center shadow-neu-in-sm">
          <Avatar name={child.name} photoPath={child.photoPath} size="lg" />
          <p className="mt-3 w-full truncate font-semibold">{child.name}</p>
          <p className="w-full truncate text-xs text-muted">
            {classLabel(child.enrollment)}
            {child.enrollment?.medium ? ` · ${child.enrollment.medium.name}` : ''}
          </p>
          <p className="text-xs text-muted">Adm. No. {child.admissionNo}</p>
        </div>
      )}

      {children.length > 1 && (
        <div className="mx-3 mt-3">
          <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted/80">Switch child</p>
          <div className="space-y-1">
            {children.map((c) => (
              <button
                key={c.id}
                onClick={() => pickChild(c.id)}
                className={clsx(
                  'flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm transition',
                  c.id === child?.id ? 'text-primary shadow-neu-in-sm' : 'text-muted hover:text-ink',
                )}
              >
                <Avatar name={c.name} photoPath={c.photoPath} size="xs" />
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                {c.id === child?.id && <Check className="h-4 w-4 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}

      <nav className="mt-4 flex-1 space-y-1 overflow-y-auto px-3 pb-3" aria-label="Portal">
        {PORTAL_MENU.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            onClick={closeMobile}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                isActive ? 'bg-primary text-white shadow-neu-sm' : 'text-muted hover:text-ink',
              )
            }
          >
            <item.icon className="h-[18px] w-[18px] shrink-0" />
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-3 pb-4">
        <button onClick={onLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-danger transition hover:shadow-neu-in-sm">
          <LogOut className="h-[18px] w-[18px]" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-base">
      {/* Desktop sidebar */}
      <aside className="relative hidden w-72 shrink-0 lg:block">
        <div className="fixed inset-y-0 left-0 z-30 w-72 p-3">
          <div className="neu-card h-full overflow-hidden">{sidebar}</div>
        </div>
      </aside>

      {/* Phone / tablet drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/30" onClick={closeMobile} aria-hidden />
          <div className="absolute inset-y-0 left-0 w-[85vw] max-w-xs p-3 animate-fade-in">
            <div className="neu-card relative h-full overflow-hidden">
              <button onClick={closeMobile} className="absolute right-3 top-5 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-muted shadow-neu-sm" aria-label="Close menu">
                <X className="h-4 w-4" />
              </button>
              {sidebar}
            </div>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 px-3 pt-3 sm:px-6">
          <div className="neu-card flex items-center justify-between gap-2 rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <button onClick={() => dispatch(setMobileNav(true))} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted shadow-neu-sm lg:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </button>
              {child && <Avatar name={child.name} photoPath={child.photoPath} size="sm" className="lg:hidden" />}
              <div className="min-w-0 leading-tight">
                <p className="truncate text-sm font-semibold">{current?.label ?? 'Parent portal'}</p>
                <p className="hidden truncate text-xs text-muted sm:block">Welcome, {user?.name}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <label className="relative flex items-center">
                <span className="sr-only">Session</span>
                <CalendarRange className="pointer-events-none absolute left-2.5 h-4 w-4 text-primary" />
                <select
                  value={sessionId ?? ''}
                  onChange={(e) => {
                    dispatch(setSession(e.target.value));
                    toast.success('Session changed');
                  }}
                  className="h-9 max-w-[8.5rem] appearance-none rounded-xl bg-base pl-8 pr-3 text-sm font-medium shadow-neu-sm outline-none sm:max-w-none sm:pr-6"
                >
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
              <button onClick={() => dispatch(toggleTheme())} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted shadow-neu-sm" aria-label="Toggle theme">
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-3 py-5 sm:px-6 sm:py-6 2xl:px-10">
          <div className="mx-auto w-full max-w-7xl">
            <Suspense fallback={<Loader />}>
              {isLoading ? (
                <Loader />
              ) : !children.length ? (
                <Card title="No students linked">
                  <p className="text-sm text-muted">Your account is not linked to any student yet. Please contact the school office.</p>
                </Card>
              ) : (
                <Outlet context={{ child, children }} />
              )}
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
