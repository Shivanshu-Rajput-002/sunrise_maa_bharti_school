import { Copy, ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useSelector } from 'react-redux';
import {
  useCopyRoutesMutation,
  useCreateBusMutation,
  useCreateRouteMutation,
  useDeleteBusMutation,
  useDeleteRouteMutation,
  useGetBusesQuery,
  useGetRoutesQuery,
  useUpdateBusMutation,
  useUpdateRouteMutation,
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
import { formatMoney } from '../../../utils/format';
import { useGetSessionsQuery } from '../../academic/services/academicApi';

function RouteForm({ initial, onClose }) {
  const [create, c] = useCreateRouteMutation();
  const [update, u] = useUpdateRouteMutation();
  const [f, setF] = useState({ name: initial?.name ?? '', annualFee: initial ? Number(initial.annualFee) : '', isActive: initial?.isActive ?? true });
  const save = async () => {
    try {
      const body = { name: f.name.trim(), annualFee: Number(f.annualFee), isActive: f.isActive };
      if (initial) await update({ id: initial.id, ...body }).unwrap();
      else await create(body).unwrap();
      toast.success('Route saved');
      onClose();
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <Modal open onClose={onClose} title={initial ? 'Edit route' : 'New route'} size="sm" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={c.isLoading || u.isLoading} onClick={save}>Save</Button></>}>
      <div className="space-y-4">
        <Input label="Village / stop" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Input label="Annual transport fee (₹)" type="number" min={0} required value={f.annualFee} onChange={(e) => setF({ ...f, annualFee: e.target.value })} hint="Split equally across this session's installments" />
        <Switch checked={f.isActive} onChange={(v) => setF({ ...f, isActive: v })} label="Active" />
      </div>
    </Modal>
  );
}

function BusForm({ initial, onClose }) {
  const [create, c] = useCreateBusMutation();
  const [update, u] = useUpdateBusMutation();
  const [f, setF] = useState({ busNo: initial?.busNo ?? '', stops: initial?.stops ?? '', driverName: initial?.driverName ?? '', driverMobile: initial?.driverMobile ?? '', gpsUrl: initial?.gpsUrl ?? '', isActive: initial?.isActive ?? true });
  const save = async () => {
    try {
      const body = { busNo: f.busNo.trim(), stops: f.stops.trim() || null, driverName: f.driverName || undefined, driverMobile: f.driverMobile || undefined, gpsUrl: f.gpsUrl || undefined, isActive: f.isActive };
      if (initial) await update({ id: initial.id, ...body }).unwrap();
      else await create(body).unwrap();
      toast.success('Bus saved');
      onClose();
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <Modal open onClose={onClose} title={initial ? 'Edit bus' : 'New bus'} size="sm" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={c.isLoading || u.isLoading} onClick={save}>Save</Button></>}>
      <div className="space-y-4">
        <Input label="Bus number" required value={f.busNo} onChange={(e) => setF({ ...f, busNo: e.target.value })} />
        <Input label="Driver name" value={f.driverName} onChange={(e) => setF({ ...f, driverName: e.target.value })} />
        <Input label="Driver mobile" inputMode="numeric" maxLength={10} value={f.driverMobile} onChange={(e) => setF({ ...f, driverMobile: e.target.value })} />
        <Input label="Stops & timings" maxLength={500} placeholder="LAXMIPURA (6.45), RAMNAGAR (7.00), …" value={f.stops} onChange={(e) => setF({ ...f, stops: e.target.value })} />
        <Input label="GPS tracking link" placeholder="https://…" value={f.gpsUrl} onChange={(e) => setF({ ...f, gpsUrl: e.target.value })} hint="Shown to parents of transport students" />
        <Switch checked={f.isActive} onChange={(v) => setF({ ...f, isActive: v })} label="Active" />
      </div>
    </Modal>
  );
}

export default function TransportPage() {
  const [tab, setTab] = useState('routes');
  const { sessionId } = useSelector(selectScope);
  const { data: sessions = [] } = useGetSessionsQuery();
  const { data: routes = [], isLoading } = useGetRoutesQuery();
  const { data: buses = [], isLoading: lb } = useGetBusesQuery();
  const [delRoute, dr] = useDeleteRouteMutation();
  const [delBus, db] = useDeleteBusMutation();
  const [copy, cp] = useCopyRoutesMutation();
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [copyFrom, setCopyFrom] = useState('');
  const canManage = usePermission('transport.manage');

  const confirmDelete = async () => {
    try {
      if (deleting.kind === 'route') await delRoute({ id: deleting.row.id }).unwrap();
      else await delBus({ id: deleting.row.id }).unwrap();
      toast.success('Deleted');
      setDeleting(null);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const actions = (kind) => (row) =>
    canManage && (
      <div className="flex justify-end gap-2">
        <Button size="icon-sm" icon={Pencil} aria-label="Edit" onClick={() => setEditing({ kind, row })} />
        <Button size="icon-sm" variant="danger" icon={Trash2} aria-label="Delete" onClick={() => setDeleting({ kind, row })} />
      </div>
    );

  return (
    <>
      <PageHeader
        title="Transport"
        subtitle="Routes and fees are per session; buses are shared."
        actions={canManage && <Button variant="primary" icon={Plus} onClick={() => setEditing({ kind: tab === 'routes' ? 'route' : 'bus', row: null })}>{tab === 'routes' ? 'New route' : 'New bus'}</Button>}
      />
      <Tabs tabs={[{ key: 'routes', label: 'Routes & fees' }, { key: 'buses', label: 'Buses & GPS' }]} value={tab} onChange={setTab} />

      {tab === 'routes' ? (
        <Card
          actions={
            canManage && (
              <div className="flex items-end gap-2">
                <Select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} placeholder="Copy from session…" options={sessions.filter((s) => s.id !== sessionId).map((s) => ({ value: s.id, label: s.name }))} className="w-48" />
                <Button icon={Copy} disabled={!copyFrom} loading={cp.isLoading} onClick={async () => { try { await copy({ id: Number(copyFrom) }).unwrap(); toast.success('Routes copied'); } catch (e) { toast.error(e.message); } }}>
                  Copy
                </Button>
              </div>
            )
          }
        >
          <DataTable
            loading={isLoading}
            rows={routes}
            columns={[
              { key: 'name', header: 'Route / village', render: (r) => <span className="font-medium">{r.name}</span> },
              { key: 'annualFee', header: 'Annual fee', render: (r) => formatMoney(Number(r.annualFee)) },
              { key: 'students', header: 'Students', className: 'tabular-nums' },
              { key: 'isActive', header: 'Status', render: (r) => <Badge tone={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'Active' : 'Inactive'}</Badge> },
              { key: 'a', header: '', className: 'text-right', render: actions('route') },
            ]}
            empty="No routes in this session — add one or copy from a previous session"
          />
        </Card>
      ) : (
        <Card>
          <DataTable
            loading={lb}
            rows={buses}
            columns={[
              { key: 'busNo', header: 'Bus', render: (b) => <span><span className="font-medium">{b.busNo}</span>{b.stops && <span className="block max-w-md whitespace-normal text-xs text-muted">{b.stops}</span>}</span> },
              { key: 'driverName', header: 'Driver' },
              { key: 'driverMobile', header: 'Mobile' },
              { key: 'gps', header: 'GPS', render: (b) => (b.gpsUrl ? <a href={b.gpsUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-primary">Track <ExternalLink className="h-3 w-3" /></a> : '—') },
              { key: 'isActive', header: 'Status', render: (b) => <Badge tone={b.isActive ? 'success' : 'neutral'}>{b.isActive ? 'Active' : 'Inactive'}</Badge> },
              { key: 'a', header: '', className: 'text-right', render: actions('bus') },
            ]}
            empty="No buses yet"
          />
        </Card>
      )}

      {editing?.kind === 'route' && <RouteForm initial={editing.row} onClose={() => setEditing(null)} />}
      {editing?.kind === 'bus' && <BusForm initial={editing.row} onClose={() => setEditing(null)} />}
      <ConfirmDialog open={!!deleting} title="Delete?" message={deleting?.kind === 'route' ? 'Only routes with no students can be deleted.' : 'The bus will be removed.'} loading={dr.isLoading || db.isLoading} onConfirm={confirmDelete} onClose={() => setDeleting(null)} />
    </>
  );
}
