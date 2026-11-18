import { KeyRound, LogOut, Menu, Moon, Sun } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import ChangePasswordModal from '../../modules/auth/components/ChangePasswordModal';
import { useLogoutMutation } from '../../modules/auth/services/authApi';
import { selectUser, setGuest } from '../../store/slices/authSlice';
import { setMobileNav, toggleTheme } from '../../store/slices/uiSlice';
import ScopeSwitcher from './ScopeSwitcher';

export default function Header() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const theme = useSelector((s) => s.ui.theme);
  const [logout] = useLogoutMutation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const close = (e) => menuRef.current && !menuRef.current.contains(e.target) && setMenuOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const onLogout = async () => {
    try {
      await logout().unwrap();
    } finally {
      dispatch(setGuest());
      navigate('/login', { replace: true });
    }
  };

  const initials = (user?.name || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 px-3 pt-3 sm:px-6 2xl:px-10">
      <div className="neu-card flex min-h-16 flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => dispatch(setMobileNav(true))}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-muted shadow-neu-sm lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <ScopeSwitcher />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => dispatch(toggleTheme())}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-muted shadow-neu-sm hover:text-primary active:shadow-neu-in-sm"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-2 rounded-xl py-1 pl-1 pr-3 shadow-neu-sm active:shadow-neu-in-sm"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-white">
                {initials}
              </span>
              <span className="hidden text-left leading-tight sm:block">
                <span className="block max-w-[140px] truncate text-sm font-medium">{user?.name}</span>
                <span className="block text-[11px] text-muted">{user?.role?.name}</span>
              </span>
            </button>

            {menuOpen && (
              <div role="menu" className="neu-card absolute right-0 mt-3 w-52 p-2 animate-fade-in">
                <button
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setPwdOpen(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink hover:shadow-neu-in-sm"
                >
                  <KeyRound className="h-4 w-4" /> Change password
                </button>
                <button
                  role="menuitem"
                  onClick={onLogout}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger hover:shadow-neu-in-sm"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <ChangePasswordModal open={pwdOpen} onClose={() => setPwdOpen(false)} />
    </header>
  );
}
