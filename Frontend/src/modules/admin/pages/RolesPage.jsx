import { zodResolver } from '@hookform/resolvers/zod';
import clsx from 'clsx';
import { Lock, Plus, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { z } from 'zod';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import Loader from '../../../components/common/Loader';
import Modal from '../../../components/common/Modal';
import PageHeader from '../../../components/common/PageHeader';
import Input from '../../../components/form/Input';
import { usePermission } from '../../../hooks/usePermission';
import {
  useCreateRoleMutation,
  useDeleteRoleMutation,
  useGetPermissionCatalogueQuery,
  useGetRolesQuery,
  useSetRolePermissionsMutation,
} from '../services/adminApi';

const schema = z.object({
  name: z.string().trim().min(2).max(50),
  slug: z.string().regex(/^[a-z][a-z0-9_]{1,49}$/, 'lowercase letters, numbers, underscore'),
});

function NewRoleModal({ onClose, onCreated }) {
  const [create, { isLoading }] = useCreateRoleMutation();
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (v) => {
    try {
      const role = await create(v).unwrap();
      toast.success('Role created');
      onCreated(role.id);
      onClose();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="New role"
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={isLoading} onClick={handleSubmit(onSubmit)}>
            Create
          </Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <Input
          label="Role name"
          required
          {...register('name', {
            onChange: (e) =>
              setValue(
                'slug',
                e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '_')
                  .replace(/^_+|_+$/g, ''),
              ),
          })}
          error={errors.name?.message}
        />
        <Input label="Slug" required {...register('slug')} error={errors.slug?.message} />
      </form>
    </Modal>
  );
}

const pretty = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export default function RolesPage() {
  const { data: allRoles = [], isLoading } = useGetRolesQuery();
  // Super admin always has everything — nothing to manage, so it is not listed
  const roles = allRoles.filter((r) => r.slug !== 'super_admin');
  const { data: catalogue = {} } = useGetPermissionCatalogueQuery();
  const [save, s] = useSetRolePermissionsMutation();
  const [del, d] = useDeleteRoleMutation();
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(new Set());
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const canUpdate = usePermission('roles.update');
  const canCreate = usePermission('roles.create');
  const canDelete = usePermission('roles.delete');

  const selected = roles.find((r) => r.id === selectedId) ?? roles[0];
  // Super admin = everything automatically; parent = portal only (fixed for safety)
  const locked = !canUpdate || selected?.slug === 'super_admin' || selected?.slug === 'parent';

  useEffect(() => {
    if (selected) setDraft(new Set(selected.permissions));
  }, [selected]);

  const dirty = useMemo(() => {
    if (!selected) return false;
    const orig = new Set(selected.permissions);
    return orig.size !== draft.size || [...draft].some((k) => !orig.has(k));
  }, [draft, selected]);

  const toggle = (key) =>
    setDraft((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const toggleModule = (keys) =>
    setDraft((prev) => {
      const next = new Set(prev);
      const all = keys.every((k) => next.has(k));
      keys.forEach((k) => (all ? next.delete(k) : next.add(k)));
      return next;
    });

  const onSave = async () => {
    try {
      await save({ id: selected.id, permissions: [...draft] }).unwrap();
      toast.success(`Permissions saved for ${selected.name}`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const confirmDelete = async () => {
    try {
      await del(deleting.id).unwrap();
      toast.success('Role deleted');
      setDeleting(null);
      setSelectedId(null);
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (isLoading) return <Loader />;

  return (
    <>
      <PageHeader
        title="Roles & permissions"
        subtitle="Control exactly what each role can see and do. Changes apply on the user's next request."
        actions={
          canCreate && (
            <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
              New role
            </Button>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card bodyClassName="p-3">
          <ul className="space-y-1">
            {roles.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => setSelectedId(r.id)}
                  className={clsx(
                    'flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition',
                    selected?.id === r.id ? 'text-primary shadow-neu-in-sm' : 'text-ink hover:text-primary',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    {r.name}
                  </span>
                  <span className="text-xs text-muted">{r.userCount}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        {selected && (
          <Card
            title={selected.name}
            subtitle={
              selected.slug === 'super_admin'
                ? 'Super admin always has every permission automatically — nothing to tick.'
                : selected.slug === 'parent'
                  ? 'Locked: parents can only open the parent portal (their own children only).'
                  : `${draft.size} permissions · ${selected.userCount} users`
            }
            actions={
              <>
                {canDelete && !selected.isSystem && (
                  <Button variant="danger" size="sm" icon={Trash2} onClick={() => setDeleting(selected)}>
                    Delete
                  </Button>
                )}
                {!locked && (
                  <Button variant="primary" size="sm" icon={Save} disabled={!dirty} loading={s.isLoading} onClick={onSave}>
                    Save
                  </Button>
                )}
              </>
            }
          >
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {Object.entries(catalogue).map(([module, keys]) => {
                const allOn = selected.slug === 'super_admin' || keys.every((k) => draft.has(k));
                return (
                  <div key={module} className="rounded-2xl p-4 shadow-neu-in-sm">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-semibold">{pretty(module)}</span>
                      {locked ? (
                        <Lock className="h-3.5 w-3.5 text-muted" />
                      ) : (
                        <button onClick={() => toggleModule(keys)} className="text-xs text-primary">
                          {allOn ? 'Clear' : 'All'}
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {keys.map((k) => {
                        const on = selected.slug === 'super_admin' || draft.has(k);
                        return (
                          <button
                            key={k}
                            disabled={locked}
                            onClick={() => toggle(k)}
                            aria-pressed={on}
                            className={clsx(
                              'rounded-lg px-2.5 py-1 text-xs font-medium transition disabled:cursor-default',
                              on ? 'bg-primary text-white shadow-neu-sm' : 'text-muted shadow-neu-sm hover:text-ink',
                            )}
                          >
                            {k.split('.')[1]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            {selected.slug === 'parent' && (
              <p className="mt-4 flex items-start gap-2 rounded-xl p-3 text-xs text-muted shadow-neu-in-sm">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>The parent role is fixed to <b>portal.view</b>. In the portal a parent sees only their own children: fee installments and receipts, dues, test report cards, admit cards released by the school, attendance, notices, class tests and bus GPS.</span>
              </p>
            )}
            {selected.isSystem && selected.slug !== 'super_admin' && selected.slug !== 'parent' && (
              <p className="mt-4 text-xs text-muted">
                <Badge>System role</Badge> <span className="ml-1">Can be edited but not deleted.</span>
              </p>
            )}
          </Card>
        )}
      </div>

      {creating && <NewRoleModal onClose={() => setCreating(false)} onCreated={setSelectedId} />}
      <ConfirmDialog
        open={!!deleting}
        title={`Delete role ${deleting?.name}?`}
        message="Only possible when no user has this role."
        loading={d.isLoading}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
