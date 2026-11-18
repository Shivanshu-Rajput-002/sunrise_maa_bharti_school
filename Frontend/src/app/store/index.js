import { configureStore, createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import authReducer, { setCredentials, setGuest } from '../../store/slices/authSlice';
import scopeReducer, { setMedium, setSession } from '../../store/slices/scopeSlice';
import uiReducer from '../../store/slices/uiSlice';
import { setupInterceptors } from '../../utils/axiosInstance';
import { baseApi } from './baseApi';

const listener = createListenerMiddleware();

/**
 * Data that is the same in every session/medium. It survives a scope switch, so the
 * header dropdowns don't blank out and refetch when the medium or session changes.
 */
const SCOPE_FREE = new Set([
  'getLoginOptions',
  'getSessions',
  'getAllSessions',
  'getMediums',
  'getClasses',
  'getSubjects',
  'getSettings',
  'getRoles',
  'getPermissionCatalogue',
]);

// Session / medium switched → drop scoped cached data so every screen refetches in the new scope
listener.startListening({
  matcher: isAnyOf(setSession, setMedium),
  effect: (_action, api) => {
    const keep = Object.values(api.getOriginalState()[baseApi.reducerPath].queries).filter(
      (q) => q?.status === 'fulfilled' && SCOPE_FREE.has(q.endpointName),
    );
    api.dispatch(baseApi.util.resetApiState());
    for (const q of keep) api.dispatch(baseApi.util.upsertQueryData(q.endpointName, q.originalArgs, q.data));
  },
});

// Logged out → clear cache so the next user never sees stale data
listener.startListening({
  actionCreator: setGuest,
  effect: (_action, api) => api.dispatch(baseApi.util.resetApiState()),
});

export const store = configureStore({
  reducer: {
    auth: authReducer,
    scope: scopeReducer,
    ui: uiReducer,
    [baseApi.reducerPath]: baseApi.reducer,
  },
  middleware: (gDM) => gDM().prepend(listener.middleware).concat(baseApi.middleware),
});

setupInterceptors(store, {
  onRefreshed: (data) => store.dispatch(setCredentials(data)),
  onAuthFailed: () => store.dispatch(setGuest()),
});
