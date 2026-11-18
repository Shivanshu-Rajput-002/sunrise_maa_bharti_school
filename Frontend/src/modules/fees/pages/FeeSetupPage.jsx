import { Copy, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useSelector } from 'react-redux';
import {
  useCopyStructureMutation,
  useCreateFeeHeadMutation,
  useCreateInstallmentMutation,
  useDeleteFeeHeadMutation,
  useDeleteInstallmentMutation,
  useGetFeeHeadsQuery,
  useGetInstallmentsQuery,
  useGetStructureQuery,
  useSaveStructureMutation,
  useUpdateFeeHeadMutation,
  useUpdateInstallmentMutation,
} from '../../../api/opsApi';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import DataTable from '../../../components/common/DataTable';
import Modal from '../../../components/common/Modal';
import PageHeader from '../../../components/common/PageHeader';
import Tabs from '../../../components/common/Tabs';
import Input from '../../../components/form/Input';
import Select from '../../../components/form/Select';
import Switch from '../../../components/form/Switch';
import { usePermission } from '../../../hooks/usePermission';
import { selectScope } from '../../../store/slices/scopeSlice';
import { formatDate, formatMoney } from '../../../utils/format';
import { useClassOptions } from '../../academic/hooks/useClassOptions';

function HeadForm({ initial, onClose }) {
  const [create, c] = useCreateFeeHeadMutation();
  const [update, u] = useUpdateFeeHeadMutation();
  const [f, setF] = useState({ name: initial?.name ?? '', appliesTo: initial?.appliesTo ?? 'all', sortOrder: initial?.sortOrder ?? 0, isActive: initial?.isActive ?? true });
  const save = async () => {
    try {
      const body = { ...f, name: f.name.trim(), sortOrder: Number(f.sortOrder) };
      if (initial) await update({ id: initial.id, ...body }).unwrap();
      else await create(body).unwrap();
      toast.success('Fee head saved');
      onClose();
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <Modal open onClose={onClose} title={initial ? 'Edit fee head' : 'New fee head'} size="sm" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={c.isLoading || u.isLoading} onClick={save}>Save</Button></>}>
      <div className="space-y-4">
        <Input label="Name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Select label="Charged to" value={f.appliesTo} onChange={(e) => setF({ ...f, appliesTo: e.target.value })} options={[{ value: 'all', label: 'All students' }, { value: 'hostel', label: 'Hostel students only' }]} />
        <Input label="Display order" type="number" value={f.sortOrder} onChange={(e) => setF({ ...f, sortOrder: e.target.value })} />
        <Switch checked={f.isActive} onChange={(v) => setF({ ...f, isActive: v })} label="Active" />
      </div>
    </Modal>
  );
}

function InstallmentForm({ initial, onClose, count }) {
  const [create, c] = useCreateInstallmentMutation();
  const [update, u] = useUpdateInstallmentMutation();
  const [f, setF] = useState({ name: initial?.name ?? '', dueDate: initial?.dueDate ?? '', sortOrder: initial?.sortOrder ?? count + 1 });
  const save = async () => {
    try {
      const body = { name: f.name.trim(), dueDate: f.dueDate, sortOrder: Number(f.sortOrder) };
      if (initial) await update({ id: initial.id, ...body }).unwrap();
      else await create(body).unwrap();
      toast.success('Installment saved');
      onClose();
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <Modal open onClose={onClose} title={initial ? 'Edit installment' : 'New installment'} size="sm" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={c.isLoading || u.isLoading} onClick={save}>Save</Button></>}>
      <div className="space-y-4">
        <Input label="Name" placeholder="e.g. 1-10 Oct" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Input label="Due date" type="date" required value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} hint="Late fee and 'overdue' are based on this date" />
        <Input label="Order" type="number" value={f.sortOrder} onChange={(e) => setF({ ...f, sortOrder: e.target.value })} />
      </div>
    </Modal>
  );
}

function StructureEditor() {
  const scope = useSelector(selectScope);
  const [sel, setSel] = useState({ mediumId: scope.mediumId ? String(scope.mediumId) : '', classId: '' });
  const { classOptions, mediumOptions } = useClassOptions(sel.classId);
  const { data: heads = [] } = useGetFeeHeadsQuery();
  const { data: insts = [] } = useGetInstallmentsQuery();
  const ready = sel.mediumId && sel.classId;
  const { data: saved, isFetching } = useGetStructureQuery({ classId: sel.classId, mediumId: sel.mediumId }, { skip: !ready });
  const [save, s] = useSaveStructureMutation();
  const [copy, cp] = useCopyStructureMutation();
  const [grid, setGrid] = useState({});
  const [copyOpen, setCopyOpen] = useState(false);
  const [targets, setTargets] = useState(new Set());
  const canManage = usePermission('fees.manage');

  useEffect(() => {
    const g = {};
    for (const r of saved ?? []) g[`${r.feeHeadId}:${r.installmentId}`] = r.amount;
    setGrid(g);
  }, [saved]);

  const val = (h, i) => grid[`${h}:${i}`] ?? '';
  const rowTotal = (h) => insts.reduce((n, i) => n + Number(val(h, i.id) || 0), 0);
  const colTotal = (i) => heads.reduce((n, h) => n + Number(val(h.id, i) || 0), 0);
  const grand = useMemo(() => heads.reduce((n, h) => n + rowTotal(h.id), 0), [grid, heads, insts]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSave = async () => {
    const items = [];
    for (const h of heads) for (const i of insts) {
      const v = Number(val(h.id, i.id) || 0);
      if (v > 0) items.push({ feeHeadId: h.id, installmentId: i.id, amount: v });
    }
    try {
      await save({ classId: Number(sel.classId), mediumId: Number(sel.mediumId), items }).unwrap();
      toast.success('Fee structure saved');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const onCopy = async () => {
    const list = [...targets].map((k) => {
      const [classId, mediumId] = k.split(':').map(Number);
      return { classId, mediumId };
    });
    try {
      await copy({ classId: Number(sel.classId), mediumId: Number(sel.mediumId), targets: list }).unwrap();
      toast.success(`Copied to ${list.length} class(es)`);
      setCopyOpen(false);
      setTargets(new Set());
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (!insts.length || !heads.length)
    return <Card><p className="text-sm text-warning">Add fee heads and this session's installments first.</p></Card>;

  return (
    <Card
      actions={
        ready && canManage && (
          <>
            <Button icon={Copy} onClick={() => setCopyOpen(true)} disabled={!saved?.length}>Copy to…</Button>
            <Button variant="primary" icon={Save} loading={s.isLoading} onClick={onSave}>Save</Button>
          </>
        )
      }
    >
      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:w-2/3">
        <Select label="Medium" value={sel.mediumId} onChange={(e) => setSel({ ...sel, mediumId: e.target.value })} placeholder="Select medium" options={mediumOptions} />
        <Select label="Class" value={sel.classId} onChange={(e) => setSel({ ...sel, classId: e.target.value })} placeholder="Select class" options={classOptions} />
      </div>
      {ready && (
        <div className="neu-inset overflow-x-auto p-1">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-3 text-left font-medium">Fee head</th>
                {insts.map((i) => (
                  <th key={i.id} className="px-3 py-3 text-right font-medium">
                    {i.name}
                    <span className="block text-[10px] normal-case text-muted/80">due {formatDate(i.dueDate)}</span>
                  </th>
                ))}
                <th className="px-3 py-3 text-right font-medium">Year</th>
              </tr>
            </thead>
            <tbody>
              {heads.map((h) => (
                <tr key={h.id} className="border-t border-line/70">
                  <td className="px-3 py-2 font-medium">
                    {h.name} {h.appliesTo === 'hostel' && <Badge className="ml-1">hostel</Badge>}
                  </td>
                  {insts.map((i) => (
                    <td key={i.id} className="px-2 py-1.5">
                      <input
                        type="number"
                        min={0}
                        disabled={!canManage || isFetching}
                        value={val(h.id, i.id)}
                        onChange={(e) => setGrid({ ...grid, [`${h.id}:${i.id}`]: e.target.value })}
                        className="w-full rounded-lg bg-base px-2 py-1.5 text-right tabular-nums shadow-neu-in-sm outline-none focus:shadow-ring"
                        aria-label={`${h.name} — ${i.name}`}
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{formatMoney(rowTotal(h.id))}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-line font-semibold">
                <td className="px-3 py-2">Total (excl. transport)</td>
                {insts.map((i) => <td key={i.id} className="px-3 py-2 text-right tabular-nums">{formatMoney(colTotal(i.id))}</td>)}
                <td className="px-3 py-2 text-right tabular-nums text-primary">{formatMoney(grand)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <Modal open={copyOpen} onClose={() => setCopyOpen(false)} title="Copy this structure to" size="lg" footer={<><Button onClick={() => setCopyOpen(false)}>Cancel</Button><Button variant="primary" disabled={!targets.size} loading={cp.isLoading} onClick={onCopy}>Copy to {targets.size}</Button></>}>
        <p className="mb-3 text-xs text-warning">Existing structures of the selected classes will be replaced.</p>
        {mediumOptions.map((m) => (
          <div key={m.value} className="mb-4">
            <p className="mb-2 text-sm font-semibold">{m.label} medium</p>
            <div className="flex flex-wrap gap-2">
              {classOptions.map((c) => {
                const k = `${c.value}:${m.value}`;
                const self = String(c.value) === sel.classId && String(m.value) === sel.mediumId;
                const on = targets.has(k);
                return (
                  <button key={k} disabled={self} onClick={() => setTargets((t) => { const n = new Set(t); on ? n.delete(k) : n.add(k); return n; })} className={`rounded-lg px-3 py-1.5 text-xs font-medium shadow-neu-sm disabled:opacity-40 ${on ? 'bg-primary text-white' : 'text-muted'}`}>
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </Modal>
    </Card>
  );
}

export default function FeeSetupPage() {
  const [tab, setTab] = useState('structure');
  const { data: heads = [], isLoading: lh } = useGetFeeHeadsQuery({ all: true });
  const { data: insts = [], isLoading: li } = useGetInstallmentsQuery();
  const [delHead, dh] = useDeleteFeeHeadMutation();
  const [delInst, di] = useDeleteInstallmentMutation();
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const canManage = usePermission('fees.manage');

  const confirmDelete = async () => {
    try {
      if (deleting.kind === 'head') await delHead({ id: deleting.row.id }).unwrap();
      else await delInst({ id: deleting.row.id }).unwrap();
      toast.success('Deleted');
      setDeleting(null);
    } catch (e) {
      toast.error(e.message);
    }
  };
  const act = (kind) => (row) =>
    canManage && (
      <div className="flex justify-end gap-2">
        <Button size="icon-sm" icon={Pencil} aria-label="Edit" onClick={() => setEditing({ kind, row })} />
        <Button size="icon-sm" variant="danger" icon={Trash2} aria-label="Delete" onClick={() => setDeleting({ kind, row })} />
      </div>
    );

  return (
    <>
      <PageHeader
        title="Fee setup"
        subtitle="Heads are shared; installments and amounts are set per session, class and medium."
        actions={canManage && tab !== 'structure' && <Button variant="primary" icon={Plus} onClick={() => setEditing({ kind: tab === 'heads' ? 'head' : 'inst', row: null })}>{tab === 'heads' ? 'New head' : 'New installment'}</Button>}
      />
      <Tabs tabs={[{ key: 'structure', label: 'Fee structure' }, { key: 'installments', label: 'Installments' }, { key: 'heads', label: 'Fee heads' }]} value={tab} onChange={setTab} />

      {tab === 'structure' && <StructureEditor />}
      {tab === 'installments' && (
        <Card>
          <DataTable loading={li} rows={insts} columns={[
            { key: 'sortOrder', header: '#', className: 'w-12' },
            { key: 'name', header: 'Installment', render: (i) => <span className="font-medium">{i.name}</span> },
            { key: 'dueDate', header: 'Due date', render: (i) => formatDate(i.dueDate) },
            { key: 'a', header: '', className: 'text-right', render: act('inst') },
          ]} empty="No installments in this session" />
        </Card>
      )}
      {tab === 'heads' && (
        <Card>
          <DataTable loading={lh} rows={heads} columns={[
            { key: 'name', header: 'Head', render: (h) => <span className="font-medium">{h.name}</span> },
            { key: 'appliesTo', header: 'Charged to', render: (h) => (h.appliesTo === 'hostel' ? 'Hostel students' : 'All students') },
            { key: 'isActive', header: 'Status', render: (h) => <Badge tone={h.isActive ? 'success' : 'neutral'}>{h.isActive ? 'Active' : 'Inactive'}</Badge> },
            { key: 'a', header: '', className: 'text-right', render: act('head') },
          ]} />
          <p className="mt-4 text-xs text-muted">Transport fee is not a head — it comes from the student's route (Transport page).</p>
        </Card>
      )}

      {editing?.kind === 'head' && <HeadForm initial={editing.row} onClose={() => setEditing(null)} />}
      {editing?.kind === 'inst' && <InstallmentForm initial={editing.row} count={insts.length} onClose={() => setEditing(null)} />}
      <ConfirmDialog open={!!deleting} title="Delete?" message="Blocked automatically if fees were already collected against it." loading={dh.isLoading || di.isLoading} onConfirm={confirmDelete} onClose={() => setDeleting(null)} />
    </>
  );
}
