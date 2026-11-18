import { Ban, FileDown, Printer, Search } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useCancelPaymentMutation, useGetPaymentsQuery } from '../../../api/opsApi';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import DataTable from '../../../components/common/DataTable';
import Modal from '../../../components/common/Modal';
import PageHeader from '../../../components/common/PageHeader';
import StatCard from '../../../components/common/StatCard';
import Input from '../../../components/form/Input';
import Select from '../../../components/form/Select';
import { useDebounce } from '../../../hooks/useDebounce';
import { usePermission } from '../../../hooks/usePermission';
import { downloadFile, openPdf } from '../../../utils/files';
import { formatDate, formatMoney } from '../../../utils/format';
import { useClassOptions } from '../../academic/hooks/useClassOptions';

export default function PaymentsPage() {
  const [f, setF] = useState({ from: '', to: '', mode: '', status: '', classId: '', page: 1 });
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search);
  const { classOptions } = useClassOptions();
  const { data, isFetching } = useGetPaymentsQuery({ ...Object.fromEntries(Object.entries(f).filter(([, v]) => v !== '')), search: debounced || undefined, limit: 25 });
  const [cancel, c] = useCancelPaymentMutation();
  const [cancelling, setCancelling] = useState(null);
  const [reason, setReason] = useState('');
  const canCancel = usePermission('fees.cancel');
  const canExport = usePermission('reports.export');
  const set = (p) => setF((x) => ({ ...x, ...p, page: p.page ?? 1 }));

  const doCancel = async () => {
    try {
      await cancel({ id: cancelling.id, reason }).unwrap();
      toast.success(`Receipt ${cancelling.receiptNo} cancelled`);
      setCancelling(null);
      setReason('');
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <>
      <PageHeader
        title="Receipts"
        subtitle="All fee receipts of the selected session."
        actions={canExport && <Button icon={FileDown} onClick={() => downloadFile('/reports/export/collection', 'fee-collection.xlsx', { from: f.from || undefined, to: f.to || undefined, classId: f.classId || undefined })}>Export Excel</Button>}
      />
      <div className="mb-6 grid gap-5 sm:grid-cols-2">
        <StatCard label="Collected (filtered)" value={data ? formatMoney(data.summary.net) : '—'} tone="success" />
        <StatCard label="Receipts" value={data?.summary.receipts ?? '—'} />
      </div>
      <Card>
        <div className="mb-5 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Input icon={Search} placeholder="Receipt, name, adm. no" value={search} onChange={(e) => { setSearch(e.target.value); set({}); }} className="lg:col-span-2" />
          <Input type="date" value={f.from} onChange={(e) => set({ from: e.target.value })} aria-label="From date" />
          <Input type="date" value={f.to} onChange={(e) => set({ to: e.target.value })} aria-label="To date" />
          <Select value={f.mode} onChange={(e) => set({ mode: e.target.value })} placeholder="All modes" options={['cash', 'upi', 'online', 'cheque', 'bank'].map((m) => ({ value: m, label: m.toUpperCase() }))} />
          <Select value={f.status} onChange={(e) => set({ status: e.target.value })} placeholder="All status" options={[{ value: 'paid', label: 'Paid' }, { value: 'cancelled', label: 'Cancelled' }]} />
          <Select value={f.classId} onChange={(e) => set({ classId: e.target.value })} placeholder="All classes" options={classOptions} />
        </div>
        <DataTable
          loading={isFetching && !data}
          rows={data?.items ?? []}
          meta={data?.meta}
          onPageChange={(page) => set({ page })}
          columns={[
            { key: 'receiptNo', header: 'Receipt', render: (p) => <span className="font-medium">{p.receiptNo}</span> },
            { key: 'date', header: 'Date', render: (p) => formatDate(p.paymentDate) },
            { key: 'student', header: 'Student', render: (p) => <div><p>{p.student?.name}</p><p className="text-xs text-muted">{p.student?.admissionNo} · {p.enrollment?.schoolClass?.name}{p.enrollment?.section ? `-${p.enrollment.section.name}` : ''}</p></div> },
            { key: 'mode', header: 'Mode', render: (p) => p.mode.toUpperCase() },
            { key: 'net', header: 'Amount', className: 'text-right tabular-nums', render: (p) => formatMoney(Number(p.netAmount)) },
            { key: 'by', header: 'By', render: (p) => p.collector?.name ?? '—' },
            { key: 'status', header: 'Status', render: (p) => <Badge tone={p.status === 'paid' ? 'success' : 'danger'}>{p.status}</Badge> },
            {
              key: 'a', header: '', className: 'text-right', render: (p) => (
                <div className="flex justify-end gap-2">
                  <Button size="icon-sm" icon={Printer} aria-label="Print receipt" onClick={() => openPdf(`/fees/payments/${p.id}/receipt.pdf`, undefined, `Fee receipt ${p.receiptNo}`)} />
                  {canCancel && p.status === 'paid' && <Button size="icon-sm" variant="danger" icon={Ban} aria-label="Cancel receipt" onClick={() => setCancelling(p)} />}
                </div>
              ),
            },
          ]}
          empty="No receipts match the filters"
        />
      </Card>
      <Modal open={!!cancelling} onClose={() => setCancelling(null)} title={`Cancel receipt ${cancelling?.receiptNo ?? ''}?`} size="sm" footer={<><Button onClick={() => setCancelling(null)}>Back</Button><Button variant="danger" disabled={reason.trim().length < 3} loading={c.isLoading} onClick={doCancel}>Cancel receipt</Button></>}>
        <p className="mb-4 text-sm text-muted">The amount goes back to the student's dues. The receipt stays on record, marked CANCELLED.</p>
        <Input label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>
    </>
  );
}
