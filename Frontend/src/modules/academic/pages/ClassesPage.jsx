import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Pencil, Plus, Trash2, X } from 'lucide-react';
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
import Select from '../../../components/form/Select';
import { usePermission } from '../../../hooks/usePermission';
import {
  useCreateClassMutation,
  useCreateSectionMutation,
  useDeleteClassMutation,
  useDeleteSectionMutation,
  useGetClassesQuery,
  useUpdateClassMutation,
} from '../services/academicApi';

const GROUPS = [
  { value: 'preprimary', label: 'Pre-primary' },
  { value: 'primary', label: 'Primary' },
  { value: 'upperprimary', label: 'Upper primary' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'highsecondary', label: 'Higher secondary' },
  { value: 'staff', label: 'Staff' },
];
const groupLabel = Object.fromEntries(GROUPS.map((g) => [g.value, g.label]));

const schema = z.object({
  name: z.string().trim().min(1, 'Required').max(30),
  nameHi: z.string().trim().max(30).optional(),
  classGroup: z.string().min(1, 'Required'),
  sortOrder: z.coerce.number().int().default(0),
  nextClassId: z.string().optional(),
});

function ClassForm({ initial, classes, onClose }) {
  const [create, c] = useCreateClassMutation();
  const [update, u] = useUpdateClassMutation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: initial
      ? { ...initial, nameHi: initial.nameHi ?? '', nextClassId: initial.nextClassId ? String(initial.nextClassId) : '' }
      : { name: '', nameHi: '', classGroup: '', sortOrder: classes.length + 1, nextClassId: '' },
  });

  const onSubmit = async (v) => {
    const payload = { ...v, nameHi: v.nameHi || undefined, nextClassId: v.nextClassId ? Number(v.nextClassId) : null };
    try {
      if (initial) await update({ id: initial.id, ...payload }).unwrap();
      else await create(payload).unwrap();
      toast.success(initial ? 'Class updated' : 'Class created');
      onClose();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? `Edit class ${initial.name}` : 'New class'}
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
        <Input label="Class name (English)" placeholder="e.g. 1, NUR, 11A" required {...register('name')} error={errors.name?.message} />
        <Input label="Class name (Hindi medium)" placeholder="e.g. I, PP+3, XIA" {...register('nameHi')} error={errors.nameHi?.message} />
        <Select label="Group" required placeholder="Select group" options={GROUPS} {...register('classGroup')} error={errors.classGroup?.message} />
        <Input label="Display order" type="number" {...register('sortOrder')} error={errors.sortOrder?.message} />
        <Select
          label="Promote to (next class)"
          className="sm:col-span-2"
          placeholder="— Final class / none —"
          options={classes.filter((x) => x.id !== initial?.id).map((x) => ({ value: x.id, label: x.name }))}
          hint="Used for bulk promotion at the end of the session"
          {...register('nextClassId')}
        />
      </form>
    </Modal>
  );
}

function SectionChips({ cls, canEdit }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [createSection, cs] = useCreateSectionMutation();
  const [deleteSection] = useDeleteSectionMutation();

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await createSection({ classId: cls.id, name: name.trim() }).unwrap();
      setName('');
      setAdding(false);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const remove = async (s) => {
    try {
      await deleteSection(s.id).unwrap();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {(cls.sections ?? []).map((s) => (
        <span key={s.id} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium shadow-neu-in-sm">
          {s.name}
          {canEdit && (
            <button onClick={() => remove(s)} className="text-muted hover:text-danger" aria-label={`Remove section ${s.name}`}>
              <X className="h-3 w-3" />
            </button>
          )}
        </span>
      ))}
      {canEdit &&
        (adding ? (
          <form onSubmit={add} className="flex items-center gap-1">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => !name && setAdding(false)}
              maxLength={10}
              placeholder="A"
              className="h-7 w-14 rounded-lg bg-base px-2 text-xs uppercase shadow-neu-in-sm outline-none"
            />
            <Button type="submit" size="sm" loading={cs.isLoading}>
              Add
            </Button>
          </form>
        ) : (
          <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-primary shadow-neu-sm">
            <Plus className="h-3 w-3" /> Section
          </button>
        ))}
    </div>
  );
}

export default function ClassesPage() {
  const { data = [], isLoading } = useGetClassesQuery(true);
  const [deleteClass, dc] = useDeleteClassMutation();
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const canCreate = usePermission('academic.create');
  const canUpdate = usePermission('academic.update');
  const canDelete = usePermission('academic.delete');

  const confirmDelete = async () => {
    try {
      await deleteClass(deleting.id).unwrap();
      toast.success('Class deleted');
      setDeleting(null);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Class',
      render: (c) => (
        <div>
          <span className="font-medium">{c.name}</span>
          {c.nameHi && <span className="ml-2 text-xs text-muted">({c.nameHi})</span>}
          {!c.isActive && <Badge className="ml-2">Inactive</Badge>}
        </div>
      ),
    },
    { key: 'classGroup', header: 'Group', render: (c) => groupLabel[c.classGroup] },
    { key: 'sections', header: 'Sections', render: (c) => <SectionChips cls={c} canEdit={canUpdate} /> },
    {
      key: 'next',
      header: 'Promotes to',
      render: (c) =>
        c.nextClass ? (
          <span className="inline-flex items-center gap-1 text-sm">
            <ArrowRight className="h-3.5 w-3.5 text-muted" /> {c.nextClass.name}
          </span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (c) => (
        <div className="flex justify-end gap-2">
          {canUpdate && <Button size="icon-sm" icon={Pencil} aria-label="Edit" onClick={() => setEditing(c)} />}
          {canDelete && <Button size="icon-sm" variant="danger" icon={Trash2} aria-label="Delete" onClick={() => setDeleting(c)} />}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Classes & sections"
        subtitle="Classes are shared by both mediums. Set 'Promotes to' for year-end promotion."
        actions={
          canCreate && (
            <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>
              New class
            </Button>
          )
        }
      />
      <Card>
        <DataTable columns={columns} rows={data} loading={isLoading} empty="No classes yet — add your first class" />
      </Card>
      {editing && <ClassForm initial={editing === 'new' ? null : editing} classes={data} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        title={`Delete class ${deleting?.name}?`}
        message="Its sections will be deleted too. This cannot be undone."
        loading={dc.isLoading}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
