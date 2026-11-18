import { apiRoutes } from '../../../api/apiRoutes';
import { baseApi } from '../../../app/store/baseApi';

const r = apiRoutes.admin;

export const adminApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    getUsers: b.query({ query: (params) => ({ url: r.users, params }), providesTags: ['User'] }),
    createUser: b.mutation({
      query: (data) => ({ url: r.users, method: 'POST', data }),
      invalidatesTags: ['User', 'Role', 'Dashboard'],
    }),
    updateUser: b.mutation({
      query: ({ id, ...data }) => ({ url: r.user(id), method: 'PATCH', data }),
      invalidatesTags: ['User', 'Role', 'Dashboard'],
    }),
    deleteUser: b.mutation({
      query: (id) => ({ url: r.user(id), method: 'DELETE' }),
      invalidatesTags: ['User', 'Role', 'Dashboard'],
    }),

    getRoles: b.query({ query: () => ({ url: r.roles }), providesTags: ['Role'] }),
    getPermissionCatalogue: b.query({ query: () => ({ url: r.permissions }), providesTags: ['Permission'] }),
    createRole: b.mutation({ query: (data) => ({ url: r.roles, method: 'POST', data }), invalidatesTags: ['Role'] }),
    updateRole: b.mutation({
      query: ({ id, ...data }) => ({ url: r.role(id), method: 'PATCH', data }),
      invalidatesTags: ['Role'],
    }),
    setRolePermissions: b.mutation({
      query: ({ id, permissions }) => ({ url: r.rolePermissions(id), method: 'PUT', data: { permissions } }),
      invalidatesTags: ['Role'],
    }),
    deleteRole: b.mutation({ query: (id) => ({ url: r.role(id), method: 'DELETE' }), invalidatesTags: ['Role'] }),
  }),
});

export const {
  useGetUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useGetRolesQuery,
  useGetPermissionCatalogueQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useSetRolePermissionsMutation,
  useDeleteRoleMutation,
} = adminApi;
