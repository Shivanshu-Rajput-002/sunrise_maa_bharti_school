import { FileDown, IndianRupee, ScrollText, Search } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGetDuesQuery } from '../../../api/opsApi';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import DataTable from '../../../components/common/DataTable';
import PageHeader from '../../../components/common/PageHeader';
import StatCard from '../../../components/common/StatCard';
import Input from '../../../components/form/Input';
import Select from '../../../components/form/Select';
import Switch from '../../../components/form/Switch';
import { useDebounce } from '../../../hooks/useDebounce';
import { usePermission } from '../../../hooks/usePermission';
import { downloadFile } from '../../../utils/files';
import { formatMoney } from '../../../utils/format';
import { useClassOptions } from '../../academic/hooks/useClassOptions';
import DueSlipModal from '../components/DueSlipModal';

export default function DuesPage() {
  const navigate = useNavigate();
  const [f, setF] = useState({ classId: '', sectionId: '', onlyDue: true, page: 1 });
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search);
  const { classOptions, sectionOptions } = useClassOptions(f.classId);
  const { data, isFetching } = useGetDuesQuery({ classId: f.classId || undefined, sectionId: f.sectionId || undefined, onlyDue: f.onlyDue, search: debounced || undefined, page: f.page, limit: 50 });
  const canCollect = usePermission('fees.collect');
  const canExport = usePermission('reports.export');
  const [slip, setSlip] = useState(null);
  const set = (p) => setF((x) => ({ ...x, ...p, page: p.page ?? 1 }));

  return (
    <>
      <PageHeader
        title="Fee dues"
        subtitle="Installments whose due date has passed are counted in 'Due till today'."
        actions={
          <>
            <Button icon={ScrollText} disabled={!f.classId} title={f.classId ? undefined : 'Select a class first'} onClick={() => setSlip({ classId: f.classId, sectionId: f.sectionId })}>Fee due slips</Button>
            {canExport && <Button icon={FileDown} onClick={() => downloadFile('/reports/export/dues', 'fee-dues.xlsx', { classId: f.classId || undefined, sectionId: f.sectionId || undefined })}>Export Excel</Button>}
          </>
        }
      />
      <div className="mb-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Due till today" value={data ? formatMoney(data.summary.dueTillDate) : '—'} tone="danger" />
        <StatCard label="Defaulters" value={data?.summary.defaulters ?? '—'} tone="warning" />
        <StatCard label="Collected" value={data ? formatMoney(data.summary.paid) : '—'} tone="success" />
        <StatCard label="Full-year due" value={data ? formatMoney(data.summary.due) : '—'} />
      </div>
      <Card>
        <div className="mb-5 grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input icon={Search} placeholder="Name, adm. no, mobile" value={search} onChange={(e) => { setSearch(e.target.value); set({}); }} />
          <Select value={f.classId} onChange={(e) => set({ classId: e.target.value, sectionId: '' })} placeholder="All classes" options={classOptions} />
          <Select value={f.sectionId} onChange={(e) => set({ sectionId: e.target.value })} placeholder="All sections" options={sectionOptions} disabled={!f.classId} />
          <div className="pb-2"><Switch checked={f.onlyDue} onChange={(v) => set({ onlyDue: v })} label="Only students with dues" /></div>
        </div>
        <DataTable
          loading={isFetching && !data}
          rows={data?.items ?? []}
          rowKey="enrollmentId"
          meta={data?.meta}
          onPageChange={(page) => set({ page })}
          columns={[
            { key: 'student', header: 'Student', render: (r) => <div><p className="font-medium">{r.student.name}</p><p className="text-xs text-muted">{r.student.admissionNo}</p></div> },
            { key: 'class', header: 'Class', render: (r) => `${r.schoolClass.name}${r.section ? `-${r.section.name}` : ''}` },
            { key: 'father', header: 'Father / mobile', render: (r) => <div><p>{r.student.fatherName ?? '—'}</p><p className="text-xs text-muted">{r.student.fatherMobile ?? ''}</p></div> },
            { key: 'paid', header: 'Paid', className: 'text-right tabular-nums', render: (r) => formatMoney(r.totals.paid) },
            { key: 'dueNow', header: 'Due till today', className: 'text-right tabular-nums', render: (r) => <span className={r.totals.dueTillDate > 0 ? 'font-semibold text-danger' : ''}>{formatMoney(r.totals.dueTillDate)}</span> },
            { key: 'due', header: 'Full year', className: 'text-right tabular-nums', render: (r) => formatMoney(r.totals.due) },
            { key: 'od', header: '', render: (r) => r.overdueInstallments > 0 && <Badge tone="danger">{r.overdueInstallments} overdue</Badge> },
            { key: 'a', header: '', className: 'text-right', render: (r) => r.totals.due > 0 && (
              <div className="flex justify-end gap-2">
                <Button size="icon-sm" icon={ScrollText} aria-label="Fee due slip" title="Fee due slip" onClick={() => setSlip({ enrollmentId: r.enrollmentId, name: r.student.name })} />
                {canCollect && <Button size="sm" icon={IndianRupee} onClick={() => navigate(`/fees/collect?enrollment=${r.enrollmentId}`)}>Collect</Button>}
              </div>
            ) },
          ]}
          empty="No dues — everyone is clear 🎉"
        />
      </Card>
      {slip && <DueSlipModal target={slip} onClose={() => setSlip(null)} />}
    </>
  );
}
