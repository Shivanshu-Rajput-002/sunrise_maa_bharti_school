import { Megaphone, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useCreateNoticeMutation, useDeleteNoticeMutation, useGetNoticesQuery, useUpdateNoticeMutation } from '../../../api/opsApi';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import Modal from '../../../components/common/Modal';
import PageHeader from '../../../components/common/PageHeader';
import Input from '../../../components/form/Input';
import Select from '../../../components/form/Select';
import Switch from '../../../components/form/Switch';
import { usePermission } from '../../../hooks/usePermission';
import { formatDate } from '../../../utils/format';
import { useClassOptions } from '../../academic/hooks/useClassOptions';

const AUD = [{ value: 'all', label: 'Everyone' }, { value: 'parents', label: 'Parents' }, { value: 'staff', label: 'Staff' }];
const today = () => new Date().toISOString().slice(0, 10);
const isActive = (n) => n.publishFrom <= today() && (!n.publishTo || n.publishTo >= today());

function NoticeForm({ initial, onClose }) {
  const [create, c] = useCreateNoticeMutation();
  const [update, u] = useUpdateNoticeMutation();
  const { classOptions } = useClassOptions();
  const [f, setF] = useState({ title: initial?.title ?? '', body: initial?.body ?? '', audience: initial?.audience ?? 'all', classId: initial?.classId ? String(initial.classId) : '', publishFrom: initial?.publishFrom ?? today(), publishTo: initial?.publishTo ?? '' });
  const save = async () => {
    try {
      const body = { title: f.title.trim(), body: f.body || undefined, audience: f.audience, classId: f.classId ? Number(f.classId) : null, publishFrom: f.publishFrom, publishTo: f.publishTo || null };
      if (initial) await update({ id: initial.id, ...body }).unwrap();
      else await create(body).unwrap();
      toast.success('Notice saved');
      onClose();
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <Modal open onClose={onClose} title={initial ? 'Edit notice' : 'New notice'} size="lg" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={c.isLoading || u.isLoading} disabled={f.title.trim().length < 3} onClick={save}>Publish</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Title" required className="sm:col-span-2" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-xs font-medium text-muted">Message</span>
          <textarea rows={5} maxLength={5000} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} className="neu-field resize-y" />
        </label>
        <Select label="Audience" value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })} options={AUD} />
        <Select label="Class" value={f.classId} onChange={(e) => setF({ ...f, classId: e.target.value })} placeholder="All classes" options={classOptions} />
        <Input label="Show from" type="date" value={f.publishFrom} onChange={(e) => setF({ ...f, publishFrom: e.target.value })} />
        <Input label="Show until" type="date" value={f.publishTo} onChange={(e) => setF({ ...f, publishTo: e.target.value })} hint="Leave empty to keep showing" />
      </div>
    </Modal>
  );
}

export default function NoticesPage() {
  const [activeOnly, setActiveOnly] = useState(false);
  const [page, setPage] = useState(1);
  const { data, isFetching } = useGetNoticesQuery({ activeOnly, page, limit: 20 });
  const [del, d] = useDeleteNoticeMutation();
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const canSend = usePermission('communication.send');
  const items = data?.items ?? [];

  return (
    <>
      <PageHeader
        title="Notices"
        subtitle="Parent notices appear in the parent portal; staff notices on staff dashboards."
        actions={
          <>
            <Switch checked={activeOnly} onChange={(v) => { setActiveOnly(v); setPage(1); }} label="Active only" />
            {canSend && <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>New notice</Button>}
          </>
        }
      />
      {isFetching && !data && <p className="text-sm text-muted">Loading…</p>}
      <div className="grid gap-5 lg:grid-cols-2">
        {items.map((n) => (
          <Card key={n.id}>
            <div className="flex items-start gap-4">
              <span className="neu-inset flex h-11 w-11 shrink-0 items-center justify-center text-primary"><Megaphone className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{n.title}</h3>
                  <Badge tone="primary">{AUD.find((a) => a.value === n.audience)?.label}</Badge>
                  {n.schoolClass && <Badge>Class {n.schoolClass.name}</Badge>}
                  <Badge tone={isActive(n) ? 'success' : 'neutral'}>{isActive(n) ? 'Live' : 'Not live'}</Badge>
                </div>
                {n.body && <p className="mt-2 whitespace-pre-line text-sm text-muted">{n.body}</p>}
                <p className="mt-3 text-xs text-muted">{formatDate(n.publishFrom)}{n.publishTo ? ` → ${formatDate(n.publishTo)}` : ''} · {n.creator?.name ?? ''}</p>
              </div>
              {canSend && (
                <div className="flex gap-2">
                  <Button size="icon-sm" icon={Pencil} aria-label="Edit" onClick={() => setEditing(n)} />
                  <Button size="icon-sm" variant="danger" icon={Trash2} aria-label="Delete" onClick={() => setDeleting(n)} />
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
      {data && !items.length && <Card><p className="py-6 text-center text-sm text-muted">No notices.</p></Card>}
      {data?.meta?.totalPages > 1 && (
        <div className="mt-6 flex justify-center gap-3">
          <Button size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <Button size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
      {editing && <NoticeForm initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog open={!!deleting} title="Delete notice?" message={deleting?.title} loading={d.isLoading} onConfirm={async () => { try { await del({ id: deleting.id }).unwrap(); toast.success('Deleted'); setDeleting(null); } catch (e) { toast.error(e.message); } }} onClose={() => setDeleting(null)} />
    </>
  );
}
