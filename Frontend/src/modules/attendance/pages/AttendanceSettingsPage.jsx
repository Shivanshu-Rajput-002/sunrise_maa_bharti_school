import { Copy, Fingerprint, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  useCreateDeviceMutation,
  useCreateHolidayMutation,
  useDeleteDeviceMutation,
  useDeleteHolidayMutation,
  useGetDevicesQuery,
  useGetHolidaysQuery,
  useToggleDeviceMutation,
} from '../../../api/opsApi';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import DataTable from '../../../components/common/DataTable';
import Modal from '../../../components/common/Modal';
import PageHeader from '../../../components/common/PageHeader';
import Input from '../../../components/form/Input';
import Switch from '../../../components/form/Switch';
import { usePermission } from '../../../hooks/usePermission';
import { formatDate, formatDateTime } from '../../../utils/format';

export default function AttendanceSettingsPage() {
  const { data: holidays = [], isLoading } = useGetHolidaysQuery();
  const [createHoliday, ch] = useCreateHolidayMutation();
  const [deleteHoliday] = useDeleteHolidayMutation();
  const canMark = usePermission('attendance.mark');
  const canDevices = usePermission('attendance.upload');
  const { data: devices = [] } = useGetDevicesQuery(undefined, { skip: !canDevices });
  const [createDevice, cd] = useCreateDeviceMutation();
  const [toggleDevice] = useToggleDeviceMutation();
  const [deleteDevice] = useDeleteDeviceMutation();
  const [h, setH] = useState({ date: '', title: '' });
  const [deviceName, setDeviceName] = useState('');
  const [deviceKey, setDeviceKey] = useState('');
  const [newKey, setNewKey] = useState(null);

  const run = async (fn, ok) => {
    try {
      await fn();
      if (ok) toast.success(ok);
    } catch (e) {
      toast.error(e.message);
    }
  };
  const endpoint = `${window.location.origin}/api/attendance/biometric`;

  return (
    <>
      <PageHeader title="Holidays & devices" subtitle="Holidays are skipped in attendance %. Biometric machines push punches with their own key." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Holidays (this session)">
          {canMark && (
            <div className="mb-5 flex flex-wrap items-end gap-3">
              <Input label="Date" type="date" value={h.date} onChange={(e) => setH({ ...h, date: e.target.value })} />
              <Input label="Occasion" value={h.title} onChange={(e) => setH({ ...h, title: e.target.value })} className="flex-1" />
              <Button variant="primary" icon={Plus} loading={ch.isLoading} disabled={!h.date || h.title.trim().length < 2} onClick={() => run(async () => { await createHoliday({ date: h.date, title: h.title.trim() }).unwrap(); setH({ date: '', title: '' }); }, 'Holiday added')}>Add</Button>
            </div>
          )}
          <DataTable loading={isLoading} rows={holidays} columns={[
            { key: 'date', header: 'Date', render: (x) => formatDate(x.date) },
            { key: 'day', header: 'Day', render: (x) => new Date(x.date).toLocaleDateString('en-IN', { weekday: 'long' }) },
            { key: 'title', header: 'Occasion' },
            { key: 'a', header: '', className: 'text-right', render: (x) => canMark && <Button size="icon-sm" variant="danger" icon={Trash2} aria-label="Delete" onClick={() => run(() => deleteHoliday({ id: x.id }).unwrap(), 'Removed')} /> },
          ]} empty="No holidays added" />
        </Card>

        {canDevices && (
          <Card title="Biometric devices">
            <div className="mb-5 flex flex-wrap items-end gap-3">
              <Input label="Device name" placeholder="e.g. Main gate" value={deviceName} onChange={(e) => setDeviceName(e.target.value)} className="flex-1" />
              <Input label="Existing key (optional)" placeholder="Key already set in the machine" value={deviceKey} onChange={(e) => setDeviceKey(e.target.value)} className="flex-1" hint="Leave empty to generate a new key" />
              <Button variant="primary" icon={Fingerprint} loading={cd.isLoading} disabled={deviceName.trim().length < 2 || (deviceKey.trim() !== '' && deviceKey.trim().length < 16)} onClick={() => run(async () => { const d = await createDevice({ name: deviceName.trim(), apiKey: deviceKey.trim() || undefined }).unwrap(); setNewKey(d); setDeviceName(''); setDeviceKey(''); })}>Add device</Button>
            </div>
            <DataTable rows={devices} columns={[
              { key: 'name', header: 'Device', render: (d) => <span className="font-medium">{d.name}</span> },
              { key: 'last', header: 'Last sync', render: (d) => formatDateTime(d.lastSeenAt) },
              { key: 'on', header: 'Active', render: (d) => <Switch checked={d.isActive} onChange={(v) => run(() => toggleDevice({ id: d.id, active: v }).unwrap())} /> },
              { key: 'a', header: '', className: 'text-right', render: (d) => <Button size="icon-sm" variant="danger" icon={Trash2} aria-label="Delete device" onClick={() => run(() => deleteDevice({ id: d.id }).unwrap(), 'Device removed')} /> },
            ]} empty="No devices" />
            <div className="mt-4 rounded-xl p-4 text-xs text-muted shadow-neu-in-sm">
              <p className="font-medium text-ink">Machine setup</p>
              <p className="mt-1">POST <span className="font-mono">{endpoint}</span></p>
              <p>Header <span className="font-mono">X-Device-Key: &lt;key&gt;</span></p>
              <p>Body <span className="font-mono">[{'{'}"punchId":"B0001","txnDateTime":"2026-11-18 08:05:00","txnId":"123"{'}'}]</span></p>
              <p className="mt-1">punchId = student's Biometric ID (set in the student form).</p>
              <p className="mt-3 font-medium text-ink">Old-site format (machine unchanged)</p>
              <p className="mt-1">POST <span className="font-mono break-all">{window.location.origin}/Api/attendence.php?apiKey=&lt;key&gt;</span></p>
              <p>Body <span className="font-mono">{'{'}"trans":[{'{'}"txnId","dvcId","punchId","txnDateTime","mode"{'}'}]{'}'}</span> → <span className="font-mono">{'{'}"transStatus":[…]{'}'}</span></p>
            </div>
          </Card>
        )}
      </div>

      <Modal open={!!newKey} onClose={() => setNewKey(null)} title={`API key for ${newKey?.name ?? ''}`} size="md" footer={<Button variant="primary" onClick={() => setNewKey(null)}>I have saved it</Button>}>
        <p className="text-sm text-warning">Copy this key now — it is shown only once and stored encrypted.</p>
        <div className="mt-3 flex items-center gap-2 rounded-xl p-3 shadow-neu-in-sm">
          <code className="flex-1 break-all text-xs">{newKey?.apiKey}</code>
          <Button size="icon-sm" icon={Copy} aria-label="Copy key" onClick={() => navigator.clipboard?.writeText(newKey.apiKey).then(() => toast.success('Copied'))} />
        </div>
      </Modal>
    </>
  );
}
