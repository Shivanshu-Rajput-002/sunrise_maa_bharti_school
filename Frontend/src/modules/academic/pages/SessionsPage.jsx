import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { z } from 'zod';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import DataTable from '../../../components/common/DataTable';
import Modal from '../../../components/common/Modal';
import PageHeader from '../../../components/common/PageHeader';
import Input from '../../../components/form/Input';
import { usePermission } from '../../../hooks/usePermission';
import { formatDate } from '../../../utils/format';
import {
  useCreateSessionMutation,
  useGetAllSessionsQuery,
  useSetCurrentSessionMutation,
  useUpdateSessionMutation,
} from '../services/academicApi';

const schema = z
  .object({
    name: z.string().regex(/^\d{4}-\d{4}$/, 'Format: 2026-2027'),
    startDate: z.string().min(1, 'Required'),
    endDate: z.string().min(1, 'Required'),
  })
  .refine((v) => v.startDate < v.endDate, { path: ['endDate'], message: 'Must be after start date' });

function SessionForm({ initial, onClose }) {
  const [create, c] = useCreateSessionMutation();
  const [update, u] = useUpdateSessionMutation();
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: initial ?? { name: '', startDate: '', endDate: '' } });

  // Typing "2027-2028" fills April–March dates automatically
  const onName = (e) => {
    const m = /^(\d{4})-(\d{4})$/.exec(e.target.value);
    if (m && !initial) {
      setValue('startDate', `${m[1]}-04-01`);
      setValue('endDate', `${m[2]}-03-31`);
    }
  };

  const onSubmit = async (values) => {
    try {
      if (initial) await update({ id: initial.id, ...values }).unwrap();
      else await create(values).unwrap();
      toast.success(initial ? 'Session updated' : 'Session created');
      onClose();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? 'Edit session' : 'New session'}
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
        <Input
          label="Session name"
          placeholder="2027-2028"
          required
          className="sm:col-span-2"
          {...register('name', { onChange: onName })}
          error={errors.name?.message}
        />
        <Input label="Start date" type="date" required {...register('startDate')} error={errors.startDate?.message} />
        <Input label="End date" type="date" required {...register('endDate')} error={errors.endDate?.message} />
      </form>
    </Modal>
  );
}

export default function SessionsPage() {
  const { data = [], isLoading } = useGetAllSessionsQuery();
  const [setCurrent, sc] = useSetCurrentSessionMutation();
  const [update] = useUpdateSessionMutation();
  const [editing, setEditing] = useState(null); // null | 'new' | session
  const canCreate = usePermission('academic.create');
  const canUpdate = usePermission('academic.update');

  const makeCurrent = async (s) => {
    try {
      await setCurrent(s.id).unwrap();
      toast.success(`${s.name} is now the current session`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const toggleActive = async (s) => {
    try {
      await update({ id: s.id, isActive: !s.isActive }).unwrap();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Session',
      render: (s) => (
        <span className="flex items-center gap-2 font-medium">
          {s.name} {s.isCurrent && <Badge tone="primary">Current</Badge>}
        </span>
      ),
    },
    { key: 'startDate', header: 'Starts', render: (s) => formatDate(s.startDate) },
    { key: 'endDate', header: 'Ends', render: (s) => formatDate(s.endDate) },
    {
      key: 'isActive',
      header: 'Status',
      render: (s) => <Badge tone={s.isActive ? 'success' : 'neutral'}>{s.isActive ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (s) =>
        canUpdate && (
          <div className="flex justify-end gap-2">
            {!s.isCurrent && s.isActive && (
              <Button size="sm" icon={CheckCircle2} loading={sc.isLoading && sc.originalArgs === s.id} onClick={() => makeCurrent(s)}>
                Make current
              </Button>
            )}
            {!s.isCurrent && (
              <Button size="sm" variant="ghost" onClick={() => toggleActive(s)}>
                {s.isActive ? 'Deactivate' : 'Activate'}
              </Button>
            )}
            <Button size="icon-sm" icon={Pencil} aria-label="Edit" onClick={() => setEditing(s)} />
          </div>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Academic sessions"
        subtitle="Every record is stored per session, so data of different years never mixes."
        actions={
          canCreate && (
            <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>
              New session
            </Button>
          )
        }
      />
      <Card>
        <DataTable columns={columns} rows={data} loading={isLoading} />
      </Card>
      {editing && <SessionForm initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
