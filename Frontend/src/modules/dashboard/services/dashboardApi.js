import { apiRoutes } from '../../../api/apiRoutes';
import { baseApi } from '../../../app/store/baseApi';

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    getDashboard: b.query({ query: () => ({ url: apiRoutes.reports.dashboard }), providesTags: ['Dashboard'] }),
  }),
});

export const { useGetDashboardQuery } = dashboardApi;
