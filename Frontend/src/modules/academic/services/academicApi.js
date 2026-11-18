import { apiRoutes } from '../../../api/apiRoutes';
import { baseApi } from '../../../app/store/baseApi';

const r = apiRoutes.academic;

export const academicApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    // Sessions
    getSessions: b.query({ query: () => ({ url: r.sessions }), providesTags: ['Session'] }),
    getAllSessions: b.query({ query: () => ({ url: r.sessionsAll }), providesTags: ['Session'] }),
    createSession: b.mutation({
      query: (data) => ({ url: r.sessions, method: 'POST', data }),
      invalidatesTags: ['Session'],
    }),
    updateSession: b.mutation({
      query: ({ id, ...data }) => ({ url: r.session(id), method: 'PATCH', data }),
      invalidatesTags: ['Session'],
    }),
    setCurrentSession: b.mutation({
      query: (id) => ({ url: r.setCurrentSession(id), method: 'POST' }),
      invalidatesTags: ['Session', 'Dashboard'],
    }),

    // Mediums
    getMediums: b.query({ query: () => ({ url: r.mediums }), providesTags: ['Medium'] }),

    // Classes & sections
    getClasses: b.query({
      query: (all = false) => ({ url: r.classes, params: all ? { all: true } : undefined }),
      providesTags: ['Class'],
    }),
    createClass: b.mutation({
      query: (data) => ({ url: r.classes, method: 'POST', data }),
      invalidatesTags: ['Class', 'Dashboard'],
    }),
    updateClass: b.mutation({
      query: ({ id, ...data }) => ({ url: r.class(id), method: 'PATCH', data }),
      invalidatesTags: ['Class'],
    }),
    deleteClass: b.mutation({
      query: (id) => ({ url: r.class(id), method: 'DELETE' }),
      invalidatesTags: ['Class', 'Dashboard'],
    }),
    createSection: b.mutation({
      query: (data) => ({ url: r.sections, method: 'POST', data }),
      invalidatesTags: ['Class', 'Dashboard'],
    }),
    deleteSection: b.mutation({
      query: (id) => ({ url: r.section(id), method: 'DELETE' }),
      invalidatesTags: ['Class', 'Dashboard'],
    }),

    // Subjects
    getSubjects: b.query({
      query: (all = false) => ({ url: r.subjects, params: all ? { all: true } : undefined }),
      providesTags: ['Subject'],
    }),
    createSubject: b.mutation({
      query: (data) => ({ url: r.subjects, method: 'POST', data }),
      invalidatesTags: ['Subject', 'Dashboard'],
    }),
    updateSubject: b.mutation({
      query: ({ id, ...data }) => ({ url: r.subject(id), method: 'PATCH', data }),
      invalidatesTags: ['Subject', 'Dashboard'],
    }),
    deleteSubject: b.mutation({
      query: (id) => ({ url: r.subject(id), method: 'DELETE' }),
      invalidatesTags: ['Subject', 'Dashboard'],
    }),
  }),
});

export const {
  useGetSessionsQuery,
  useGetAllSessionsQuery,
  useCreateSessionMutation,
  useUpdateSessionMutation,
  useSetCurrentSessionMutation,
  useGetMediumsQuery,
  useGetClassesQuery,
  useCreateClassMutation,
  useUpdateClassMutation,
  useDeleteClassMutation,
  useCreateSectionMutation,
  useDeleteSectionMutation,
  useGetSubjectsQuery,
  useCreateSubjectMutation,
  useUpdateSubjectMutation,
  useDeleteSubjectMutation,
} = academicApi;
