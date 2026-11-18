import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import Loader from '../common/Loader';
import Header from './Header';
import Sidebar from './Sidebar';

export default function AdminLayout() {
  return (
    <div className="flex min-h-screen bg-base">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 px-3 py-5 sm:px-6 sm:py-6 2xl:px-10">
          {/* Caps line length on very wide screens; full width below that */}
          <div className="mx-auto w-full max-w-[1600px]">
            <Suspense fallback={<Loader />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
