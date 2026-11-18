import axios from 'axios';
import { apiRoutes } from '../api/apiRoutes';

const baseURL = import.meta.env.VITE_API_URL || '/api';

const axiosInstance = axios.create({ baseURL, withCredentials: true, timeout: 30000 });

/** Plain client (no interceptors) for the refresh call itself */
const rawClient = axios.create({ baseURL, withCredentials: true, timeout: 15000 });

let store; // injected in setupInterceptors() to avoid a circular import
let refreshPromise = null;

/**
 * Exchanges the httpOnly refresh cookie for a new access token.
 * Concurrent 401s share one in-flight refresh.
 */
export function refreshSession() {
  if (!refreshPromise) {
    const sessionId = store?.getState().scope.sessionId ?? undefined;
    refreshPromise = rawClient
      .post(apiRoutes.auth.refresh, { sessionId })
      .then((res) => res.data.data)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export function setupInterceptors(appStore, { onRefreshed, onAuthFailed }) {
  store = appStore;

  axiosInstance.interceptors.request.use((config) => {
    const { auth, scope } = store.getState();
    if (auth.accessToken) config.headers.Authorization = `Bearer ${auth.accessToken}`;
    if (scope.sessionId) config.headers['x-session-id'] = scope.sessionId;
    config.headers['x-medium-id'] = scope.mediumId ?? 'all';
    return config;
  });

  axiosInstance.interceptors.response.use(
    (res) => res.data, // unwrap { success, data }
    async (error) => {
      const original = error.config;
      const status = error.response?.status;

      // 401 from login/refresh means bad credentials, not an expired token — don't retry those
      const isAuthCall = /\/auth\/(login|refresh|logout)/.test(original?.url || '');
      if (status === 401 && original && !original._retried && !isAuthCall) {
        original._retried = true;
        try {
          const data = await refreshSession();
          onRefreshed(data);
          original.headers.Authorization = `Bearer ${data.accessToken}`;
          return axiosInstance(original);
        } catch {
          onAuthFailed();
        }
      }

      const body = error.response?.data;
      const message = Array.isArray(body?.message)
        ? body.message.join(', ')
        : body?.message || (error.code === 'ECONNABORTED' ? 'Request timed out' : 'Network error, please retry');
      return Promise.reject({ status, message, data: body });
    },
  );
}

export default axiosInstance;
