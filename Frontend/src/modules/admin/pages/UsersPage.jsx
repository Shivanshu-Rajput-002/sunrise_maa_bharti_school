import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useSelector } from 'react-redux';
import { z } from 'zod';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import DataTable from '../../../components/common/DataTable';
import Modal from '../../../components/common/Modal';
import PageHeader from '../../../components/common/PageHeader';
import Input from '../../../components/form/Input';
import Select from '../../../components/form/Select';
import Switch from '../../../components/form/Switch';
import { useDebounce } from '../../../hooks/useDebounce';
import { usePermission } from '../../../hooks/usePermission';
import { selectUser } from '../../../store/slices/authSlice';
import { formatDateTime } from '../../../utils/format';
import {
  useCreateUserMutation,
  useDeleteUserMutation,
  useGetRolesQuery,
  useGetUsersQuery,
  useUpdateUserMutation,
} from '../services/adminApi';

const baseSchema = {
  name: z.string().trim().min(2, 'At least 2 characters').max(120),
  username: z
    .string()
    .trim()
    .min(3, 'At least 3 characters')
    .max(80)
    .regex(/^[a-zA-Z0-9._@-]+$/, 'Letters, numbers and . _ @ - only'),
  email: z.union([z.literal(''), z.string().email('Invalid email')]),
  mobile: z.union([z.literal(''), z.string().regex(/^\d{10}$/, '10 digit mobile')]),
  roleId: z.coerce.number({ message: 'Select a role' }).int().positive('Select a role'),
};
const createSchema = z.object({ ...baseSchema, password: z.string().min(6, 'At least 6 characters').max(72) });
const editSchema = z.object({
  ...baseSchema,
  password: z.union([z.literal(''), z.string().min(6, 'At least 6 characters').max(72)]),
});

function UserForm({ initial, roles, onClose }) {
  const [create, c] = useCreateUserMutation();
  const [update, u] = useUpdateUserMutation();
  const [isActive, setActive] = useState(initial?.isActive ?? true);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(initial ? editSchema : createSchema),
    defaultValues: {
      name: initial?.name ?? '',
      username: initial?.username ?? '',
      email: initial?.email ?? '',
      mobile: initial?.mobile ?? '',
      roleId: initial?.roleId ? String(initial.roleId) : '',
      password: '',
    },
  });

  const onSubmit = async (v) => {
    const payload = {
      ...v,
      email: v.email || undefined,
      mobile: v.mobile || undefined,
      password: v.password || undefined,
      isActive,
    };
    try {
      if (initial) await update({ id: initial.id, ...payload }).unwrap();
      else await create(payload).unwrap();
      toast.success(initial ? 'User updated' : 'User created');
      onClose();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? `Edit ${initial.name}` : 'New user'}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={c.isLoading || u.isLoading} onClick={handleSubmit(onSubmit)}>
            Save
          </Button>
        </>
      }
    >
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
        <Input label="Full name" required {...register('name')} error={errors.name?.message} />
        <Input label="Username" required autoComplete="off" {...register('username')} error={errors.username?.message} />
        <Input label="Mobile" inputMode="numeric" {...register('mobile')} error={errors.mobile?.message} />
        <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
        <Select
          label="Role"
          required
          placeholder="Select role"
          options={roles.map((r) => ({ value: r.id, label: r.name }))}
          {...register('roleId')}
          error={errors.roleId?.message}
        />
        <Input
          label={initial ? 'New password' : 'Password'}
          type="password"
          autoComplete="new-password"
          required={!initial}
          hint={initial ? 'Leave blank to keep the current password' : undefined}
          {...register('password')}
          error={errors.password?.message}
        />
        <div className="sm:col-span-2">
          <Switch checked={isActive} onChange={setActive} label="Account active (can sign in)" />
        </div>
      </form>
    </Modal>
  );
}

export default function UsersPage() {
  const me = useSelector(selectUser);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleId, setRoleId] = useState('');
  const debounced = useDebounce(search);
  const { data, isFetching } = useGetUsersQuery({
    page,
    limit: 20,
    search: debounced || undefined,
    roleId: roleId || undefined,
  });
  const { data: roles = [] } = useGetRolesQuery();
  const [del, d] = useDeleteUserMutation();
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const canCreate = usePermission('users.create');
  const canUpdate = usePermission('users.update');
  const canDelete = usePermission('users.delete');

  const confirmDelete = async () => {
    try {
      await del(deleting.id).unwrap();
      toast.success('User removed');
      setDeleting(null);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'User',
      render: (u) => (
        <div>
          <p className="font-medium">{u.name}</p>
          <p className="text-xs text-muted">@{u.username}</p>
        </div>
      ),
    },
    { key: 'role', header: 'Role', render: (u) => <Badge tone="primary">{u.role?.name}</Badge> },
    { key: 'mobile', header: 'Mobile' },
    { key: 'lastLoginAt', header: 'Last login', render: (u) => formatDateTime(u.lastLoginAt) },
    {
      key: 'isActive',
      header: 'Status',
      render: (u) => <Badge tone={u.isActive ? 'success' : 'danger'}>{u.isActive ? 'Active' : 'Disabled'}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (u) => (
        <div className="flex justify-end gap-2">
          {canUpdate && <Button size="icon-sm" icon={Pencil} aria-label="Edit" onClick={() => setEditing(u)} />}
          {canDelete && u.id !== me?.id && (
            <Button size="icon-sm" variant="danger" icon={Trash2} aria-label="Delete" onClick={() => setDeleting(u)} />
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Staff, teachers and parent accounts."
        actions={
          canCreate && (
            <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>
              New user
            </Button>
          )
        }
      />
      <Card>
        <div className="mb-5 flex flex-wrap gap-4">
          <Input
            icon={Search}
            placeholder="Search name, username, mobile…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-80"
          />
          <Select
            value={roleId}
            onChange={(e) => {
              setRoleId(e.target.value);
              setPage(1);
            }}
            placeholder="All roles"
            options={roles.map((r) => ({ value: r.id, label: r.name }))}
            className="w-full sm:w-52"
          />
        </div>
        <DataTable columns={columns} rows={data?.items ?? []} loading={isFetching && !data} meta={data?.meta} onPageChange={setPage} />
      </Card>
      {editing && <UserForm initial={editing === 'new' ? null : editing} roles={roles} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        title={`Remove ${deleting?.name}?`}
        message="The user will no longer be able to sign in. Their history stays in the audit log."
        confirmText="Remove"
        loading={d.isLoading}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
