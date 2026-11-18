import { createSlice } from '@reduxjs/toolkit';

/**
 * Access token lives ONLY in memory (not localStorage) to limit XSS impact.
 * On reload the app silently calls /auth/refresh using the httpOnly cookie.
 */
const initialState = {
  status: 'checking', // checking | authenticated | guest
  accessToken: null,
  user: null,
  permissions: [],
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, { payload }) {
      state.accessToken = payload.accessToken;
      state.user = payload.user;
      state.permissions = payload.permissions ?? [];
      state.status = 'authenticated';
    },
    setAccessToken(state, { payload }) {
      state.accessToken = payload;
    },
    setGuest() {
      return { ...initialState, status: 'guest' };
    },
  },
});

export const { setCredentials, setAccessToken, setGuest } = authSlice.actions;
export default authSlice.reducer;

export const selectAuth = (s) => s.auth;
export const selectUser = (s) => s.auth.user;
export const selectPermissions = (s) => s.auth.permissions;
