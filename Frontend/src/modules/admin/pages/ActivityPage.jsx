import { History } from 'lucide-react';
import { useState } from 'react';
import { useGetAuditKindsQuery, useGetAuditLogsQuery, useGetUsersQuery } from '../services/adminApi';
import Badge from '../../../components/common/Badge';
import Card from '../../../components/common/Card';
import DataTable from '../../../components/common/DataTable';
import PageHeader from '../../../components/common/PageHeader';
import Input from '../../../components/form/Input';
import Select from '../../../components/form/Select';
import { formatDateTime } from '../../../utils/format';

/** What the record is about, in plain words */
const ENTITY = {
  auth: 'Login',
  student: 'Student',
  student_enrollment: 'Enrollment',
  student_photo: 'Student photo',
  fee_payment: 'Fee receipt',
  fee_head: 'Fee head',
  fee_installment: 'Fee installment',
  fee_structure: 'Fee structure',
  fee_concession: 'Concession',
  cashbook_entry: 'Cashbook entry',
  cashbook_head: 'Cashbook head',
  attendance: 'Student attendance',
  staff_attendance: 'Staff attendance',
  staff: 'Staff',
  holiday: 'Holiday',
  biometric_device: 'Biometric device',
  exam: 'Exam',
  exam_schedule: 'Exam timetable / marks',
  certificate: 'Certificate',
  notice: 'Notice',
  user: 'Login account',
  role: 'Role',
  role_permissions: 'Role permissions',
  settings: 'Settings',
  session: 'Session',
  class: 'Class',
  section: 'Section',
  subject: 'Subject',
  route: 'Transport route',
  bus: 'Bus',
};
const ACTION = {
  login: 'Signed in',
  create: 'Added',
  update: 'Changed',
  delete: 'Deleted',
  collect: 'Collected',
  cancel: 'Cancelled',
  issue: 'Issued',
  mark: 'Marked',
  marks: 'Entered marks',
  marks_import: 'Uploaded marks (Excel)',
  promote: 'Promoted',
  status: 'Status changed',
  assign_rolls: 'Assigned roll numbers',
  link_parent: 'Linked parent login',
  unlink_parent: 'Removed parent login',
  bulk_parent_logins: 'Created parent logins',
  reset_password: 'Reset password',
  update_login: 'Changed login',
  enable: 'Enabled',
  disable: 'Disabled',
  import: 'Imported',
};
const TONE = { delete: 'danger', cancel: 'danger', disable: 'danger', create: 'success', collect: 'success', issue: 'success', login: 'neutral' };

const label = (e) => ENTITY[e] ?? e.replace(/_/g, ' ');
const verb = (a) => ACTION[a] ?? a.replace(/_/g, ' ');

/** Short human detail from the meta saved with each action */
function detail(r) {
  const m = r.meta ?? {};
  const bits = [];
  if (m.receiptNo) bits.push(`Receipt ${m.receiptNo}`);
  if (m.amount != null) bits.push(`₹${Number(m.amount).toLocaleString('en-IN')}`);
  if (m.serialNo) bits.push(m.serialNo);
  if (m.type) bits.push(String(m.type));
  if (m.count != null) bits.push(`${m.count} records`);
  if (m.created != null) bits.push(`${m.created} created${m.linked ? `, ${m.linked} linked` : ''}`);
  if (m.saved != null) bits.push(`${m.saved} saved${m.errors ? `, ${m.errors} errors` : ''}`);
  if (m.date) bits.push(String(m.date));
  if (Array.isArray(m.fields)) bits.push(`Fields: ${m.fields.join(', ')}`);
  if (m.reason) bits.push(`Reason: ${m.reason}`);
  if (!bits.length && r.entityId) bits.push(`#${r.entityId}`);
  return bits.join(' · ');
}

export default function ActivityPage() {
  const [f, setF] = useState({ userId: '', kind: '', from: '', to: '', page: 1 });
  const [entity, action] = f.kind ? f.kind.split('|') : [undefined, undefined];
  const { data, isFetching } = useGetAuditLogsQuery({ userId: f.userId || undefined, entity, action, from: f.from || undefined, to: f.to || undefined, page: f.page, limit: 30 });
  const { data: kinds = [] } = useGetAuditKindsQuery();
  const { data: users } = useGetUsersQuery({ limit: 200 });
  const set = (p) => setF((x) => ({ ...x, ...p, page: p.page ?? 1 }));

  const userOptions = (users?.items ?? []).map((u) => ({ value: u.id, label: `${u.name} (${u.username})` }));
  const kindOptions = kinds
    .map((k) => ({ value: `${k.entity}|${k.action}`, label: `${label(k.entity)} — ${verb(k.action)}` }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <>
      <PageHeader title="User activity" subtitle="Who did what and when — logins, fee collection, admissions, marks, certificates, settings changes." />
      <Card>
        <div className="mb-5 grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select label="User" value={f.userId} onChange={(e) => set({ userId: e.target.value })} placeholder="All users" options={userOptions} />
          <Select label="Activity" value={f.kind} onChange={(e) => set({ kind: e.target.value })} placeholder="All activities" options={kindOptions} />
          <Input label="From" type="date" value={f.from} onChange={(e) => set({ from: e.target.value })} />
          <Input label="To" type="date" value={f.to} onChange={(e) => set({ to: e.target.value })} />
        </div>
        <DataTable
          loading={isFetching && !data}
          rows={data?.items ?? []}
          meta={data?.meta}
          onPageChange={(page) => set({ page })}
          empty="No activity for these filters"
          columns={[
            { key: 'when', header: 'When', render: (r) => <span className="whitespace-nowrap text-xs">{formatDateTime(r.createdAt)}</span> },
            {
              key: 'who',
              header: 'User',
              render: (r) => (r.user ? <span><span className="font-medium">{r.user.name}</span><span className="block text-xs text-muted">{r.user.username}</span></span> : <span className="text-xs text-muted">System / machine</span>),
            },
            {
              key: 'what',
              header: 'Activity',
              render: (r) => (
                <span className="flex flex-wrap items-center gap-2">
                  <Badge tone={TONE[r.action] ?? 'primary'}>{verb(r.action)}</Badge>
                  <span>{label(r.entity)}</span>
                </span>
              ),
            },
            { key: 'detail', header: 'Details', render: (r) => <span className="text-xs text-muted">{detail(r)}</span> },
            { key: 'ip', header: 'IP', render: (r) => <span className="font-mono text-xs text-muted">{r.ip ?? ''}</span> },
          ]}
        />
        <p className="mt-4 flex items-center gap-2 text-xs text-muted"><History className="h-3.5 w-3.5" /> Activity is kept for audit and cannot be edited.</p>
      </Card>
    </>
  );
}
