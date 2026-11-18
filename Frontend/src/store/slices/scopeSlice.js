import { createSlice } from '@reduxjs/toolkit';
import { storage } from '../../utils/storage';

/**
 * Global data scope: active academic session + medium.
 * Every API request sends these as headers; the backend filters all data by them,
 * so data from different sessions never mixes.
 */
const toNum = (v) => (v && v !== 'all' ? Number(v) : null);

const scopeSlice = createSlice({
  name: 'scope',
  initialState: {
    sessionId: toNum(storage.get('sessionId')),
    mediumId: toNum(storage.get('mediumId')), // null = all mediums
  },
  reducers: {
    setSession(state, { payload }) {
      state.sessionId = payload ? Number(payload) : null;
      storage.set('sessionId', state.sessionId);
    },
    setMedium(state, { payload }) {
      state.mediumId = toNum(payload);
      storage.set('mediumId', state.mediumId ?? 'all');
    },
  },
});

export const { setSession, setMedium } = scopeSlice.actions;
export default scopeSlice.reducer;

export const selectScope = (s) => s.scope;
