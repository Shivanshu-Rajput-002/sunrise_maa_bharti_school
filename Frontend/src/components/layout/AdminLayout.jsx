import { Suspense } from 'react';
import { useSelector } from 'react-redux';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { selectUser } from '../../store/slices/authSlice';
import ErrorBoundary from '../common/ErrorBoundary';
import Loader from '../common/Loader';
import Header from './Header';
import Sidebar from './Sidebar';

export default function AdminLayout() {
  const { pathname } = useLocation();
  const user = useSelector(selectUser);
  // Parents never see the school's admin screens — only their portal
  if (user?.role?.slug === 'parent') return <Navigate to="/portal" replace />;
  return (
    <div className="flex min-h-screen bg-base">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 px-3 py-5 sm:px-6 sm:py-6 2xl:px-10">
          {/* Caps line length on very wide screens; full width below that */}
          <div className="mx-auto w-full max-w-[1600px]">
            {/* A crash on one page keeps the sidebar/header and clears when you navigate */}
            <ErrorBoundary inline resetKey={pathname}>
              <Suspense fallback={<Loader />}>
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
