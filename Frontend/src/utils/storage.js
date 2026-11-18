// localStorage can throw (private mode, blocked storage) — never let that break the app
export const storage = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : v;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      if (value === null || value === undefined) localStorage.removeItem(key);
      else localStorage.setItem(key, String(value));
    } catch {
      /* ignore */
    }
  },
};
