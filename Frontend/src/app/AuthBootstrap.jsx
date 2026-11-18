import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setCredentials, setGuest } from '../store/slices/authSlice';
import { setSession } from '../store/slices/scopeSlice';
import { refreshSession } from '../utils/axiosInstance';

/**
 * On first load: try the httpOnly refresh cookie. Success → signed in silently
 * (keeps the session the user had selected); failure → show login.
 */
export default function AuthBootstrap({ children }) {
  const dispatch = useDispatch();

  useEffect(() => {
    let cancelled = false;
    refreshSession()
      .then((data) => {
        if (cancelled) return;
        dispatch(setSession(data.sessionId));
        dispatch(setCredentials(data));
      })
      .catch(() => !cancelled && dispatch(setGuest()));
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  return children;
}
