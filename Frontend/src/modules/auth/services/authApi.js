import { apiRoutes } from '../../../api/apiRoutes';
import { baseApi } from '../../../app/store/baseApi';

export const authApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    getLoginOptions: b.query({ query: () => ({ url: apiRoutes.auth.loginOptions }) }),
    login: b.mutation({ query: (body) => ({ url: apiRoutes.auth.login, method: 'POST', data: body }) }),
    logout: b.mutation({ query: () => ({ url: apiRoutes.auth.logout, method: 'POST' }) }),
    changePassword: b.mutation({
      query: (body) => ({ url: apiRoutes.auth.changePassword, method: 'POST', data: body }),
    }),
  }),
});

export const { useGetLoginOptionsQuery, useLoginMutation, useLogoutMutation, useChangePasswordMutation } = authApi;
