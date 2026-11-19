import { Pencil, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useCreateStaffMutation, useGetStaffQuery, useUpdateStaffMutation } from '../../../api/opsApi';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import DataTable from '../../../components/common/DataTable';
import Modal from '../../../components/common/Modal';
import PageHeader from '../../../components/common/PageHeader';
import Input from '../../../components/form/Input';
import Select from '../../../components/form/Select';
import Switch from '../../../components/form/Switch';
import { useDebounce } from '../../../hooks/useDebounce';
import { usePermission } from '../../../hooks/usePermission';
import { formatDate } from '../../../utils/format';
import { useGetUsersQuery } from '../../admin/services/adminApi';

const DESIGNATIONS = ['Principal', 'Teacher', 'Accountant', 'Clerk', 'Librarian', 'Driver', 'Conductor', 'Peon', 'Guard', 'Cook', 'Other'];

function StaffForm({ initial, onClose }) {
  const canUsers = usePermission('users.view');
  const { data: users } = useGetUsersQuery({ limit: 200 }, { skip: !canUsers });
  const [create, c] = useCreateStaffMutation();
  const [update, u] = useUpdateStaffMutation();
  const [f, setF] = useState({
    name: initial?.name ?? '',
    designation: initial?.designation ?? '',
    mobile: initial?.mobile ?? '',
    biometricId: initial?.biometricId ?? '',
    joiningDate: initial?.joiningDate ?? '',
    userId: initial?.userId ? String(initial.userId) : '',
    isActive: initial?.isActive ?? true,
  });
  const bad = f.name.trim().length < 2 || (f.mobile && !/^\d{10}$/.test(f.mobile));

  const save = async () => {
    const body = {
      name: f.name.trim(),
      designation: f.designation.trim() || null,
      mobile: f.mobile || null,
      biometricId: f.biometricId.trim() || null,
      joiningDate: f.joiningDate || null,
      userId: f.userId ? Number(f.userId) : null,
      isActive: f.isActive,
    };
    try {
      if (initial) await update({ id: initial.id, ...body }).unwrap();
      else await create(body).unwrap();
      toast.success('Staff saved');
      onClose();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const loginOptions = (users?.items ?? users ?? []).filter((x) => x.role?.slug !== 'parent').map((x) => ({ value: x.id, label: `${x.name} (${x.username})` }));

  return (
    <Modal open onClose={onClose} title={initial ? `Edit ${initial.name}` : 'Add staff'} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={c.isLoading || u.isLoading} disabled={bad} onClick={save}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Name" required className="sm:col-span-2" value={f.name} maxLength={120} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Designation</span>
          <input list="designations" className="neu-field" value={f.designation} maxLength={60} placeholder="e.g. Teacher, Driver" onChange={(e) => setF({ ...f, designation: e.target.value })} />
          <datalist id="designations">{DESIGNATIONS.map((d) => <option key={d} value={d} />)}</datalist>
        </label>
        <Input label="Mobile" inputMode="numeric" maxLength={10} value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value.replace(/\D/g, '') })} error={f.mobile && !/^\d{10}$/.test(f.mobile) ? '10 digits' : undefined} />
        <Input label="Biometric ID" value={f.biometricId} maxLength={30} onChange={(e) => setF({ ...f, biometricId: e.target.value })} hint="The punch ID this person uses on the machine" />
        <Input label="Joining date" type="date" value={f.joiningDate} onChange={(e) => setF({ ...f, joiningDate: e.target.value })} />
        {canUsers && <Select label="Login account (optional)" className="sm:col-span-2" value={f.userId} onChange={(e) => setF({ ...f, userId: e.target.value })} placeholder="No login" options={loginOptions} />}
        <div className="sm:col-span-2"><Switch checked={f.isActive} onChange={(v) => setF({ ...f, isActive: v })} label="Active (counted in attendance)" /></div>
      </div>
    </Modal>
  );
}

export default function StaffPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('active');
  const debounced = useDebounce(search);
  const { data = [], isFetching } = useGetStaffQuery({ search: debounced || undefined, status });
  const [editing, setEditing] = useState(null);
  const canManage = usePermission('staff.manage');

  return (
    <>
      <PageHeader title="Staff directory" subtitle="Everyone who works at the school — with or without a login. Biometric ID links the attendance machine." actions={canManage && <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>Add staff</Button>} />
      <Card>
        <div className="mb-5 grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Input icon={Search} placeholder="Name, mobile or biometric ID" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: 'active', label: 'Active staff' }, { value: 'inactive', label: 'Inactive' }, { value: 'all', label: 'All' }]} />
        </div>
        <DataTable
          loading={isFetching && !data.length}
          rows={data}
          empty="No staff yet — add the first one"
          columns={[
            { key: 'name', header: 'Name', render: (s) => <span><span className="font-medium">{s.name}</span><span className="block text-xs text-muted">{s.designation ?? '—'}</span></span> },
            { key: 'mobile', header: 'Mobile', render: (s) => s.mobile ?? '—' },
            { key: 'bio', header: 'Biometric ID', render: (s) => (s.biometricId ? <span className="font-mono text-xs">{s.biometricId}</span> : <span className="text-xs text-warning">Not set</span>) },
            { key: 'login', header: 'Login', render: (s) => (s.user ? <span className="text-xs">{s.user.username}</span> : <span className="text-xs text-muted">No login</span>) },
            { key: 'join', header: 'Joined', render: (s) => (s.joiningDate ? formatDate(s.joiningDate) : '—') },
            { key: 'st', header: 'Status', render: (s) => <Badge tone={s.isActive ? 'success' : 'neutral'}>{s.isActive ? 'Active' : 'Inactive'}</Badge> },
            { key: 'a', header: '', className: 'text-right', render: (s) => canManage && <Button size="icon-sm" icon={Pencil} aria-label={`Edit ${s.name}`} onClick={() => setEditing(s)} /> },
          ]}
        />
      </Card>
      {editing && <StaffForm initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
