import { createSlice } from '@reduxjs/toolkit';
import { storage } from '../../utils/storage';

const initialTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    theme: initialTheme,
    sidebarCollapsed: storage.get('sidebarCollapsed') === '1',
    mobileNavOpen: false,
  },
  reducers: {
    toggleTheme(state) {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', state.theme);
      storage.set('theme', state.theme);
    },
    toggleSidebar(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      storage.set('sidebarCollapsed', state.sidebarCollapsed ? '1' : '0');
    },
    setMobileNav(state, { payload }) {
      state.mobileNavOpen = payload;
    },
  },
});

export const { toggleTheme, toggleSidebar, setMobileNav } = uiSlice.actions;
export default uiSlice.reducer;
