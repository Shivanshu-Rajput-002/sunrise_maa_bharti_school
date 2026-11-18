import { useSelector } from 'react-redux';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Loader from '../../components/common/Loader';
import { selectAuth } from '../../store/slices/authSlice';

/** Waits for the silent refresh on page load, then lets authenticated users through */
export default function ProtectedRoute() {
  const { status } = useSelector(selectAuth);
  const location = useLocation();

  if (status === 'checking') return <Loader fullScreen label="Signing you in…" />;
  if (status !== 'authenticated') return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
