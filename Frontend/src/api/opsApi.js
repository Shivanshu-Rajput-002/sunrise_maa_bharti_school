import { baseApi } from '../app/store/baseApi';

/**
 * Endpoints for settings, transport, fees, cashbook, attendance, exams, notices,
 * student documents and the parent portal. Grouped in one injection to keep cache
 * tags consistent across modules (a collected payment refreshes dues, ledger, dashboard…).
 */
const q = (url, tags) => ({ query: (params) => ({ url: typeof url === 'function' ? url(params) : url, params: typeof url === 'function' ? undefined : params }), providesTags: tags });
const m = (method, url, tags) => ({
  query: (arg) => {
    const { id, ...data } = arg ?? {};
    return { url: typeof url === 'function' ? url(arg) : url, method, data: method === 'DELETE' ? undefined : typeof url === 'function' ? data : arg };
  },
  invalidatesTags: tags,
});

export const opsApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    // ---------- settings ----------
    getSettings: b.query(q('/admin/settings', ['Settings'])),
    saveSchool: b.mutation(m('PUT', '/admin/settings/school', ['Settings'])),
    saveFeeSettings: b.mutation(m('PUT', '/admin/settings/fees', ['Settings', 'Ledger'])),
    saveGrades: b.mutation(m('PUT', '/admin/settings/grades', ['Settings', 'Result'])),
    savePrintSettings: b.mutation(m('PUT', '/admin/settings/print', ['Settings'])),

    // ---------- transport ----------
    getRoutes: b.query(q('/transport/routes', ['Route'])),
    createRoute: b.mutation(m('POST', '/transport/routes', ['Route'])),
    updateRoute: b.mutation(m('PATCH', (a) => `/transport/routes/${a.id}`, ['Route', 'Ledger', 'Dues'])),
    deleteRoute: b.mutation(m('DELETE', (a) => `/transport/routes/${a.id}`, ['Route'])),
    copyRoutes: b.mutation(m('POST', (a) => `/transport/routes/copy-from/${a.id}`, ['Route'])),
    getBuses: b.query(q('/transport/buses', ['Bus'])),
    createBus: b.mutation(m('POST', '/transport/buses', ['Bus'])),
    updateBus: b.mutation(m('PATCH', (a) => `/transport/buses/${a.id}`, ['Bus'])),
    deleteBus: b.mutation(m('DELETE', (a) => `/transport/buses/${a.id}`, ['Bus'])),

    // ---------- fee setup ----------
    getFeeHeads: b.query(q('/fees/heads', ['FeeHead'])),
    createFeeHead: b.mutation(m('POST', '/fees/heads', ['FeeHead'])),
    updateFeeHead: b.mutation(m('PATCH', (a) => `/fees/heads/${a.id}`, ['FeeHead', 'Ledger'])),
    deleteFeeHead: b.mutation(m('DELETE', (a) => `/fees/heads/${a.id}`, ['FeeHead'])),
    getInstallments: b.query(q('/fees/installments', ['Installment'])),
    createInstallment: b.mutation(m('POST', '/fees/installments', ['Installment'])),
    updateInstallment: b.mutation(m('PATCH', (a) => `/fees/installments/${a.id}`, ['Installment', 'Ledger', 'Dues'])),
    deleteInstallment: b.mutation(m('DELETE', (a) => `/fees/installments/${a.id}`, ['Installment', 'Structure'])),
    getStructure: b.query(q('/fees/structure', ['Structure'])),
    saveStructure: b.mutation(m('PUT', '/fees/structure', ['Structure', 'Ledger', 'Dues', 'Dashboard'])),
    copyStructure: b.mutation(m('POST', '/fees/structure/copy', ['Structure', 'Ledger', 'Dues'])),
    setConcession: b.mutation(m('PUT', (a) => `/fees/concessions/${a.id}`, ['Ledger', 'Dues', 'Dashboard'])),
    removeConcession: b.mutation(m('DELETE', (a) => `/fees/concessions/${a.id}`, ['Ledger', 'Dues', 'Dashboard'])),

    // ---------- collection ----------
    getLedger: b.query(q((id) => `/fees/ledger/${id}`, ['Ledger'])),
    collectFee: b.mutation(m('POST', '/fees/payments', ['Ledger', 'Payment', 'Dues', 'Dashboard', 'CashEntry', 'Portal'])),
    getPayments: b.query(q('/fees/payments', ['Payment'])),
    cancelPayment: b.mutation(m('POST', (a) => `/fees/payments/${a.id}/cancel`, ['Ledger', 'Payment', 'Dues', 'Dashboard', 'CashEntry'])),
    getDues: b.query(q('/fees/dues', ['Dues'])),

    // ---------- cashbook ----------
    getCashHeads: b.query(q('/cashbook/heads', ['CashHead'])),
    createCashHead: b.mutation(m('POST', '/cashbook/heads', ['CashHead'])),
    updateCashHead: b.mutation(m('PATCH', (a) => `/cashbook/heads/${a.id}`, ['CashHead'])),
    deleteCashHead: b.mutation(m('DELETE', (a) => `/cashbook/heads/${a.id}`, ['CashHead'])),
    getCashEntries: b.query(q('/cashbook/entries', ['CashEntry'])),
    createCashEntry: b.mutation(m('POST', '/cashbook/entries', ['CashEntry'])),
    updateCashEntry: b.mutation(m('PATCH', (a) => `/cashbook/entries/${a.id}`, ['CashEntry'])),
    cancelCashEntry: b.mutation(m('POST', (a) => `/cashbook/entries/${a.id}/cancel`, ['CashEntry'])),

    // ---------- attendance ----------
    getAttendanceSheet: b.query(q('/attendance/sheet', ['Attendance'])),
    markAttendance: b.mutation(m('POST', '/attendance/mark', ['Attendance', 'Dashboard'])),
    getRegister: b.query(q('/attendance/register', ['Attendance'])),
    getHolidays: b.query(q('/attendance/holidays', ['Holiday'])),
    createHoliday: b.mutation(m('POST', '/attendance/holidays', ['Holiday', 'Attendance'])),
    deleteHoliday: b.mutation(m('DELETE', (a) => `/attendance/holidays/${a.id}`, ['Holiday', 'Attendance'])),
    getDevices: b.query(q('/attendance/devices', ['Device'])),
    createDevice: b.mutation(m('POST', '/attendance/devices', ['Device'])),
    toggleDevice: b.mutation({ query: ({ id, active }) => ({ url: `/attendance/devices/${id}`, method: 'PATCH', params: { active } }), invalidatesTags: ['Device'] }),
    deleteDevice: b.mutation(m('DELETE', (a) => `/attendance/devices/${a.id}`, ['Device'])),

    // ---------- staff ----------
    getStaff: b.query(q('/staff', ['Staff'])),
    createStaff: b.mutation(m('POST', '/staff', ['Staff', 'StaffAttendance', 'Dashboard'])),
    updateStaff: b.mutation(m('PATCH', (a) => `/staff/${a.id}`, ['Staff', 'StaffAttendance', 'Dashboard'])),
    getStaffDay: b.query(q('/staff/attendance', ['StaffAttendance'])),
    markStaff: b.mutation(m('PUT', '/staff/attendance', ['StaffAttendance', 'Dashboard'])),
    getStaffRegister: b.query(q('/staff/attendance/register', ['StaffAttendance'])),
    getStaffSettings: b.query(q('/staff/settings', ['StaffAttendance'])),
    saveStaffSettings: b.mutation(m('PUT', '/staff/settings', ['StaffAttendance', 'Dashboard'])),

    // ---------- exams ----------
    getExams: b.query(q('/exams', ['Exam'])),
    createExam: b.mutation(m('POST', '/exams', ['Exam'])),
    updateExam: b.mutation(m('PATCH', (a) => `/exams/${a.id}`, ['Exam', 'Result', 'Portal'])),
    deleteExam: b.mutation(m('DELETE', (a) => `/exams/${a.id}`, ['Exam'])),
    getSchedule: b.query({ query: ({ examId, classId }) => ({ url: `/exams/${examId}/schedule`, params: { classId } }), providesTags: ['Schedule'] }),
    saveSchedule: b.mutation({ query: ({ examId, ...data }) => ({ url: `/exams/${examId}/schedule`, method: 'PUT', data }), invalidatesTags: ['Schedule', 'Result'] }),
    getMarks: b.query(q('/exams/marks', ['Marks'])),
    saveMarks: b.mutation(m('PUT', '/exams/marks', ['Marks', 'Result'])),
    getMarksheetExtras: b.query(q((id) => `/exams/marksheet-extras/${id}`, ['Extras'])),
    saveMarksheetExtras: b.mutation({ query: ({ id, ...data }) => ({ url: `/exams/marksheet-extras/${id}`, method: 'PUT', data }), invalidatesTags: ['Extras'] }),
    getResult: b.query({ query: ({ examId, ...params }) => ({ url: `/exams/${examId}/result`, params }), providesTags: ['Result'] }),

    // ---------- notices ----------
    getNotices: b.query(q('/notices', ['Notice'])),
    createNotice: b.mutation(m('POST', '/notices', ['Notice', 'Dashboard'])),
    updateNotice: b.mutation(m('PATCH', (a) => `/notices/${a.id}`, ['Notice', 'Dashboard'])),
    deleteNotice: b.mutation(m('DELETE', (a) => `/notices/${a.id}`, ['Notice', 'Dashboard'])),

    // ---------- student documents ----------
    getCertificateRegister: b.query(q('/students/certificates/register', ['Certificate'])),
    getCertificates: b.query(q((id) => `/students/${id}/certificates`, ['Certificate'])),
    issueCertificate: b.mutation(m('POST', (a) => `/students/${a.id}/certificates`, ['Certificate', 'Student'])),
    getParentAccounts: b.query(q('/students/parent-accounts', ['User'])),
    linkParent: b.mutation(m('PUT', (a) => `/students/${a.id}/parent`, ['Student', 'User', 'Parents'])),
    unlinkParent: b.mutation(m('DELETE', (a) => `/students/${a.id}/parent`, ['Student', 'Parents'])),
    getParents: b.query(q('/students/parents', ['Parents'])),
    bulkParentLogins: b.mutation(m('POST', '/students/parents/bulk-logins', ['Parents', 'Student', 'User'])),
    updateParentLogin: b.mutation(m('PATCH', (a) => `/students/parents/${a.id}`, ['Parents', 'User', 'Student'])),
    resetParentPassword: b.mutation(m('POST', (a) => `/students/parents/${a.id}/reset-password`, [])),
    setParentActive: b.mutation(m('PATCH', (a) => `/students/parents/${a.id}/active`, ['Parents', 'User'])),

    // ---------- parent portal ----------
    getRecycleBin: b.query({ query: () => ({ url: '/students/recycle-bin/list' }), providesTags: ['Student'], keepUnusedDataFor: 0 }),
    restoreStudent: b.mutation(m('POST', (a) => `/students/${a.id}/restore`, ['Student', 'Dashboard', 'Parents'])),
    getChildren: b.query(q('/portal/children', ['Portal'])),
    getChildFees: b.query(q((id) => `/portal/children/${id}/fees`, ['Portal'])),
    getChildAttendance: b.query(q((id) => `/portal/children/${id}/attendance`, ['Portal'])),
    getChildResults: b.query(q((id) => `/portal/children/${id}/results`, ['Portal'])),
    getChildExams: b.query(q((id) => `/portal/children/${id}/exams`, ['Portal'])),
    getPortalNotices: b.query(q('/portal/notices', ['Portal'])),
    getPortalBuses: b.query(q('/portal/buses', ['Portal'])),
  }),
});

export const {
  useGetSettingsQuery, useSaveSchoolMutation, useSaveFeeSettingsMutation, useSaveGradesMutation,
  useGetRoutesQuery, useCreateRouteMutation, useUpdateRouteMutation, useDeleteRouteMutation, useCopyRoutesMutation,
  useGetBusesQuery, useCreateBusMutation, useUpdateBusMutation, useDeleteBusMutation,
  useGetFeeHeadsQuery, useCreateFeeHeadMutation, useUpdateFeeHeadMutation, useDeleteFeeHeadMutation,
  useGetInstallmentsQuery, useCreateInstallmentMutation, useUpdateInstallmentMutation, useDeleteInstallmentMutation,
  useGetStructureQuery, useSaveStructureMutation, useCopyStructureMutation, useSetConcessionMutation, useRemoveConcessionMutation,
  useGetLedgerQuery, useCollectFeeMutation, useGetPaymentsQuery, useCancelPaymentMutation, useGetDuesQuery,
  useGetCashHeadsQuery, useCreateCashHeadMutation, useUpdateCashHeadMutation, useDeleteCashHeadMutation,
  useGetCashEntriesQuery, useCreateCashEntryMutation, useUpdateCashEntryMutation, useCancelCashEntryMutation,
  useGetAttendanceSheetQuery, useMarkAttendanceMutation, useGetRegisterQuery, useGetHolidaysQuery, useCreateHolidayMutation,
  useDeleteHolidayMutation, useGetDevicesQuery, useCreateDeviceMutation, useToggleDeviceMutation, useDeleteDeviceMutation,
  useGetStaffQuery, useCreateStaffMutation, useUpdateStaffMutation, useGetStaffDayQuery, useMarkStaffMutation,
  useGetStaffRegisterQuery, useGetStaffSettingsQuery, useSaveStaffSettingsMutation,
  useGetExamsQuery, useCreateExamMutation, useUpdateExamMutation, useDeleteExamMutation, useGetScheduleQuery, useSaveScheduleMutation,
  useGetMarksQuery, useSaveMarksMutation, useGetResultQuery, useGetMarksheetExtrasQuery, useSaveMarksheetExtrasMutation, useSavePrintSettingsMutation,
  useGetNoticesQuery, useCreateNoticeMutation, useUpdateNoticeMutation, useDeleteNoticeMutation,
  useGetCertificateRegisterQuery, useGetCertificatesQuery, useIssueCertificateMutation, useGetParentAccountsQuery, useLinkParentMutation, useUnlinkParentMutation,
  useGetParentsQuery, useUpdateParentLoginMutation, useBulkParentLoginsMutation, useResetParentPasswordMutation, useSetParentActiveMutation,
  useGetRecycleBinQuery, useRestoreStudentMutation,
  useGetChildrenQuery, useGetChildFeesQuery, useGetChildAttendanceQuery, useGetChildResultsQuery, useGetChildExamsQuery,
  useGetPortalNoticesQuery, useGetPortalBusesQuery,
} = opsApi;
