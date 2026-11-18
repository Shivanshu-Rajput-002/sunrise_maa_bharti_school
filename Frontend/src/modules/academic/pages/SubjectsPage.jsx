import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { z } from 'zod';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import DataTable from '../../../components/common/DataTable';
import Modal from '../../../components/common/Modal';
import PageHeader from '../../../components/common/PageHeader';
import Input from '../../../components/form/Input';
import Switch from '../../../components/form/Switch';
import { usePermission } from '../../../hooks/usePermission';
import {
  useCreateSubjectMutation,
  useDeleteSubjectMutation,
  useGetSubjectsQuery,
  useUpdateSubjectMutation,
} from '../services/academicApi';

const schema = z.object({
  name: z.string().trim().min(1, 'Required').max(100),
  code: z.string().trim().max(20).optional(),
});

function SubjectForm({ initial, onClose }) {
  const [create, c] = useCreateSubjectMutation();
  const [update, u] = useUpdateSubjectMutation();
  const [isActive, setActive] = useState(initial?.isActive ?? true);
  const [isAdditional, setAdditional] = useState(initial?.isAdditional ?? false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { name: initial?.name ?? '', code: initial?.code ?? '' } });

  const onSubmit = async (v) => {
    const payload = { ...v, code: v.code || undefined, isActive, isAdditional };
    try {
      if (initial) await update({ id: initial.id, ...payload }).unwrap();
      else await create(payload).unwrap();
      toast.success(initial ? 'Subject updated' : 'Subject created');
      onClose();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? 'Edit subject' : 'New subject'}
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={c.isLoading || u.isLoading} onClick={handleSubmit(onSubmit)}>
            Save
          </Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <Input label="Subject name" required {...register('name')} error={errors.name?.message} />
        <Input label="Code" placeholder="Optional, e.g. HIN" {...register('code')} error={errors.code?.message} />
        <Switch checked={isActive} onChange={setActive} label="Active" />
        <Switch checked={isAdditional} onChange={setAdditional} label="Additional subject (printed below the main total on the marksheet)" />
      </form>
    </Modal>
  );
}

export default function SubjectsPage() {
  const { data = [], isLoading } = useGetSubjectsQuery(true);
  const [del, d] = useDeleteSubjectMutation();
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const canCreate = usePermission('academic.create');
  const canUpdate = usePermission('academic.update');
  const canDelete = usePermission('academic.delete');

  const confirmDelete = async () => {
    try {
      await del(deleting.id).unwrap();
      toast.success('Subject deleted');
      setDeleting(null);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const columns = [
    { key: 'name', header: 'Subject', render: (s) => <span className="font-medium">{s.name}</span> },
    { key: 'code', header: 'Code' },
    { key: 'isAdditional', header: 'Marksheet', render: (s) => (s.isAdditional ? <Badge tone="warning">Additional</Badge> : 'Main') },
    {
      key: 'isActive',
      header: 'Status',
      render: (s) => <Badge tone={s.isActive ? 'success' : 'neutral'}>{s.isActive ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (s) => (
        <div className="flex justify-end gap-2">
          {canUpdate && <Button size="icon-sm" icon={Pencil} aria-label="Edit" onClick={() => setEditing(s)} />}
          {canDelete && <Button size="icon-sm" variant="danger" icon={Trash2} aria-label="Delete" onClick={() => setDeleting(s)} />}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Subjects"
        subtitle="Master list of subjects used in timetables, exams and report cards."
        actions={
          canCreate && (
            <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>
              New subject
            </Button>
          )
        }
      />
      <Card>
        <DataTable columns={columns} rows={data} loading={isLoading} empty="No subjects yet" />
      </Card>
      {editing && <SubjectForm initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        title={`Delete ${deleting?.name}?`}
        message="Prefer marking it inactive if it was used in past sessions."
        loading={d.isLoading}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
