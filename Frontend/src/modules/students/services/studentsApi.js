import { apiRoutes } from '../../../api/apiRoutes';
import { baseApi } from '../../../app/store/baseApi';

const r = apiRoutes.students;
const changed = ['Student', 'Dashboard'];

export const studentsApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    getStudents: b.query({ query: (params) => ({ url: r.list, params }), providesTags: ['Student'] }),
    getStudent: b.query({ query: (id) => ({ url: r.one(id) }), providesTags: (_res, _err, id) => [{ type: 'Student', id }] }),
    admitStudent: b.mutation({ query: (data) => ({ url: r.list, method: 'POST', data }), invalidatesTags: changed }),
    updateStudent: b.mutation({
      query: ({ id, ...data }) => ({ url: r.one(id), method: 'PATCH', data }),
      invalidatesTags: changed,
    }),
    updateStudentStatus: b.mutation({
      query: ({ id, ...data }) => ({ url: r.status(id), method: 'PATCH', data }),
      invalidatesTags: changed,
    }),
    deleteStudent: b.mutation({ query: (id) => ({ url: r.one(id), method: 'DELETE' }), invalidatesTags: changed }),
    uploadStudentPhoto: b.mutation({
      query: ({ id, file }) => {
        const data = new FormData();
        data.append('photo', file);
        return { url: r.photo(id), method: 'POST', data };
      },
      invalidatesTags: ['Student'],
    }),
    assignRolls: b.mutation({ query: (data) => ({ url: r.rollNumbers, method: 'POST', data }), invalidatesTags: ['Student'] }),
    promoteStudents: b.mutation({ query: (data) => ({ url: r.promote, method: 'POST', data }), invalidatesTags: changed }),
  }),
});

export const {
  useGetStudentsQuery,
  useGetStudentQuery,
  useAdmitStudentMutation,
  useUpdateStudentMutation,
  useUpdateStudentStatusMutation,
  useDeleteStudentMutation,
  useUploadStudentPhotoMutation,
  useAssignRollsMutation,
  usePromoteStudentsMutation,
} = studentsApi;
