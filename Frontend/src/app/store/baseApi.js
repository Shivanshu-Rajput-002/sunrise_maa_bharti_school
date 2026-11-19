import { createApi } from '@reduxjs/toolkit/query/react';
import axiosInstance from '../../utils/axiosInstance';

/** RTK Query base query on top of the shared axios instance (auth + scope headers, refresh) */
const axiosBaseQuery =
  () =>
  async ({ url, method = 'GET', data, params }) => {
    try {
      const res = await axiosInstance({ url, method, data, params });
      return { data: res.data };
    } catch (err) {
      return { error: err };
    }
  };

/**
 * Module services inject their endpoints into this API (modules/<x>/services/*Api.js).
 * Cache is reset whenever the session/medium scope changes (see app/store/index.js).
 */
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: axiosBaseQuery(),
  tagTypes: [
    'Dashboard', 'Session', 'Medium', 'Class', 'Subject', 'User', 'Role', 'Permission', 'Student', 'Settings',
    'Route', 'Bus', 'FeeHead', 'Installment', 'Structure', 'Ledger', 'Payment', 'Dues', 'CashHead', 'CashEntry',
    'Attendance', 'Holiday', 'Device', 'Exam', 'Schedule', 'Marks', 'Result', 'Notice', 'Certificate', 'Portal', 'Extras', 'Staff', 'StaffAttendance', 'Parents',
  ],
  endpoints: () => ({}),
});
