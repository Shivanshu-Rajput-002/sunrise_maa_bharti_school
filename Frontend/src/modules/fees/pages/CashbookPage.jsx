import { Pencil, Plus, Search, Settings2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  useCreateCashEntryMutation,
  useCreateCashHeadMutation,
  useDeleteCashEntryMutation,
  useDeleteCashHeadMutation,
  useGetCashEntriesQuery,
  useGetCashHeadsQuery,
  useUpdateCashEntryMutation,
  useUpdateCashHeadMutation,
} from '../../../api/opsApi';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import DataTable from '../../../components/common/DataTable';
import Modal from '../../../components/common/Modal';
import PageHeader from '../../../components/common/PageHeader';
import StatCard from '../../../components/common/StatCard';
import Input from '../../../components/form/Input';
import Select from '../../../components/form/Select';
import Switch from '../../../components/form/Switch';
import { useDebounce } from '../../../hooks/useDebounce';
import { usePermission } from '../../../hooks/usePermission';
import { formatDate, formatMoney } from '../../../utils/format';

const MODES = ['cash', 'upi', 'online', 'cheque', 'bank'].map((m) => ({ value: m, label: m.toUpperCase() }));

function EntryForm({ initial, heads, onClose }) {
  const [create, c] = useCreateCashEntryMutation();
  const [update, u] = useUpdateCashEntryMutation();
  const [f, setF] = useState({
    headId: initial?.headId ? String(initial.headId) : '',
    entryDate: initial?.entryDate ?? new Date().toISOString().slice(0, 10),
    amount: initial ? Number(initial.amount) : '',
    party: initial?.party ?? '',
    mode: initial?.mode ?? 'cash',
    remarks: initial?.remarks ?? '',
  });
  const save = async () => {
    try {
      const body = { headId: Number(f.headId), entryDate: f.entryDate, amount: Number(f.amount), party: f.party || undefined, mode: f.mode, remarks: f.remarks || undefined };
      if (initial) await update({ id: initial.id, ...body }).unwrap();
      else await create(body).unwrap();
      toast.success('Entry saved');
      onClose();
    } catch (e) {
      toast.error(e.message);
    }
  };
  const opts = (type) => heads.filter((h) => h.isActive && h.type === type).map((h) => ({ value: h.id, label: h.name }));
  return (
    <Modal open onClose={onClose} title={initial ? 'Edit entry' : 'New entry'} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={c.isLoading || u.isLoading} disabled={!f.headId || !f.amount} onClick={save}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-xs font-medium text-muted">Head *</span>
          <select value={f.headId} onChange={(e) => setF({ ...f, headId: e.target.value })} className="neu-field">
            <option value="">Select head</option>
            <optgroup label="Expense">{opts('expense').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>
            <optgroup label="Income">{opts('income').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>
          </select>
        </label>
        <Input label="Date" type="date" value={f.entryDate} onChange={(e) => setF({ ...f, entryDate: e.target.value })} />
        <Input label="Amount (₹)" type="number" min={0} required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        <Input label="Party / paid to" value={f.party} onChange={(e) => setF({ ...f, party: e.target.value })} />
        <Select label="Mode" value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })} options={MODES} />
        <Input label="Remarks" className="sm:col-span-2" value={f.remarks} onChange={(e) => setF({ ...f, remarks: e.target.value })} />
      </div>
    </Modal>
  );
}

function HeadsModal({ heads, onClose }) {
  const [create, c] = useCreateCashHeadMutation();
  const [update] = useUpdateCashHeadMutation();
  const [del] = useDeleteCashHeadMutation();
  const [f, setF] = useState({ name: '', type: 'expense' });
  const run = async (fn) => {
    try {
      await fn();
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <Modal open onClose={onClose} title="Cashbook heads" size="lg">
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <Input label="New head" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="flex-1" />
        <Select label="Type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} options={[{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }]} />
        <Button variant="primary" icon={Plus} loading={c.isLoading} disabled={f.name.trim().length < 2} onClick={() => run(async () => { await create({ name: f.name.trim(), type: f.type }).unwrap(); setF({ ...f, name: '' }); })}>Add</Button>
      </div>
      <ul className="space-y-2">
        {heads.map((h) => (
          <li key={h.id} className="flex items-center justify-between rounded-xl px-4 py-2 shadow-neu-in-sm">
            <span className="flex items-center gap-2 text-sm">{h.name} <Badge tone={h.type === 'income' ? 'success' : 'warning'}>{h.type}</Badge></span>
            <span className="flex items-center gap-3">
              <Switch checked={h.isActive} onChange={(v) => run(() => update({ id: h.id, isActive: v }).unwrap())} />
              <Button size="icon-sm" variant="danger" icon={Trash2} aria-label="Delete head" onClick={() => run(() => del({ id: h.id }).unwrap())} />
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

export default function CashbookPage() {
  const [f, setF] = useState({ from: '', to: '', type: '', headId: '', page: 1 });
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search);
  const { data: heads = [] } = useGetCashHeadsQuery();
  const { data, isFetching } = useGetCashEntriesQuery({ ...Object.fromEntries(Object.entries(f).filter(([, v]) => v !== '')), search: debounced || undefined, limit: 25 });
  const [del, d] = useDeleteCashEntryMutation();
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [headsOpen, setHeadsOpen] = useState(false);
  const canCreate = usePermission('cashbook.create');
  const canUpdate = usePermission('cashbook.update');
  const canDelete = usePermission('cashbook.delete');
  const set = (p) => setF((x) => ({ ...x, ...p, page: p.page ?? 1 }));
  const s = data?.summary;

  return (
    <>
      <PageHeader
        title="Cashbook"
        subtitle="Day-to-day income and expenses. Fee collections are added to income automatically."
        actions={
          <>
            {canUpdate && <Button icon={Settings2} onClick={() => setHeadsOpen(true)}>Heads</Button>}
            {canCreate && <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>New entry</Button>}
          </>
        }
      />
      <div className="mb-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Fee collection" value={s ? formatMoney(s.feeCollection) : '—'} tone="success" />
        <StatCard label="Other income" value={s ? formatMoney(s.otherIncome) : '—'} tone="success" />
        <StatCard label="Expenses" value={s ? formatMoney(s.expense) : '—'} tone="danger" />
        <StatCard label="Balance" value={s ? formatMoney(s.balance) : '—'} />
      </div>
      <Card>
        <div className="mb-5 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <Input icon={Search} placeholder="Party or remarks" value={search} onChange={(e) => { setSearch(e.target.value); set({}); }} />
          <Input type="date" value={f.from} onChange={(e) => set({ from: e.target.value })} aria-label="From" />
          <Input type="date" value={f.to} onChange={(e) => set({ to: e.target.value })} aria-label="To" />
          <Select value={f.type} onChange={(e) => set({ type: e.target.value })} placeholder="Income & expense" options={[{ value: 'income', label: 'Income' }, { value: 'expense', label: 'Expense' }]} />
          <Select value={f.headId} onChange={(e) => set({ headId: e.target.value })} placeholder="All heads" options={heads.map((h) => ({ value: h.id, label: h.name }))} />
        </div>
        <DataTable
          loading={isFetching && !data}
          rows={data?.items ?? []}
          meta={data?.meta}
          onPageChange={(page) => set({ page })}
          columns={[
            { key: 'date', header: 'Date', render: (e) => formatDate(e.entryDate) },
            { key: 'head', header: 'Head', render: (e) => e.head?.name },
            { key: 'party', header: 'Party' },
            { key: 'mode', header: 'Mode', render: (e) => e.mode.toUpperCase() },
            { key: 'remarks', header: 'Remarks' },
            { key: 'amount', header: 'Amount', className: 'text-right tabular-nums', render: (e) => <span className={e.type === 'income' ? 'text-success' : 'text-danger'}>{e.type === 'income' ? '+' : '−'} {formatMoney(Number(e.amount))}</span> },
            { key: 'a', header: '', className: 'text-right', render: (e) => (
              <div className="flex justify-end gap-2">
                {canUpdate && <Button size="icon-sm" icon={Pencil} aria-label="Edit" onClick={() => setEditing(e)} />}
                {canDelete && <Button size="icon-sm" variant="danger" icon={Trash2} aria-label="Delete" onClick={() => setDeleting(e)} />}
              </div>
            ) },
          ]}
          empty="No entries for these filters"
        />
      </Card>
      {editing && <EntryForm initial={editing === 'new' ? null : editing} heads={heads} onClose={() => setEditing(null)} />}
      {headsOpen && <HeadsModal heads={heads} onClose={() => setHeadsOpen(false)} />}
      <ConfirmDialog open={!!deleting} title="Delete entry?" message={`${deleting?.head?.name ?? ''} · ${formatMoney(Number(deleting?.amount ?? 0))}`} loading={d.isLoading} onConfirm={async () => { try { await del({ id: deleting.id }).unwrap(); toast.success('Deleted'); setDeleting(null); } catch (e) { toast.error(e.message); } }} onClose={() => setDeleting(null)} />
    </>
  );
}
