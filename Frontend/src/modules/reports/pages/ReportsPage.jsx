import { CalendarCheck, FileDown, FileText, IndianRupee, ListChecks, Receipt, Users, UsersRound } from 'lucide-react';
import { useState } from 'react';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import PageHeader from '../../../components/common/PageHeader';
import Input from '../../../components/form/Input';
import Select from '../../../components/form/Select';
import { usePermission } from '../../../hooks/usePermission';
import { downloadFile, openPdf } from '../../../utils/files';
import { useClassOptions } from '../../academic/hooks/useClassOptions';

/**
 * Each report: which filters it uses and which extra permission it needs
 * (the backend enforces the same rules).
 */
const REPORTS = [
  { type: 'students', title: 'Students list', desc: 'All students with class, parents, contact and documents.', icon: UsersRound, filters: ['class'] },
  { type: 'parents', title: 'Parents list', desc: 'One row per family with all children — for calls and messages.', icon: Users, filters: ['class'] },
  { type: 'attendance', title: 'Attendance register', desc: 'Month-wise day-by-day attendance with % for a class.', icon: CalendarCheck, filters: ['class', 'month'], needs: 'attendance.view', required: ['class', 'month'] },
  { type: 'collection', title: 'Fee collection', desc: 'Every receipt in the period with discount, fine and mode.', icon: Receipt, filters: ['class', 'dates'], needs: 'fees.view' },
  { type: 'daywise', title: 'Day-wise collection', desc: 'Daily totals split by cash / UPI / online / cheque / bank.', icon: IndianRupee, filters: ['dates'], needs: 'fees.view' },
  { type: 'dues', title: 'Fee dues', desc: 'Student-wise payable, paid and due (till today and full year).', icon: ListChecks, filters: ['class'], needs: 'fees.view' },
  { type: 'ptm', title: 'PTM sheet', desc: 'Class list with parent name, mobile and a signature column.', icon: FileText, filters: ['class'], required: ['class'], pdf: true },
];

function ReportCard({ r, classOptions, sectionOptionsFor }) {
  const [f, setF] = useState({ classId: '', sectionId: '', from: '', to: '', month: new Date().toISOString().slice(0, 7) });
  const params = {
    classId: f.classId || undefined,
    sectionId: f.sectionId || undefined,
    ...(r.filters.includes('dates') ? { from: f.from || undefined, to: f.to || undefined } : {}),
    ...(r.filters.includes('month') ? { month: f.month } : {}),
  };
  const missing = (r.required ?? []).some((k) => (k === 'class' ? !f.classId : k === 'month' ? !f.month : false));
  const Icon = r.icon;
  return (
    <Card>
      <div className="flex items-start gap-4">
        <span className="neu-inset flex h-11 w-11 shrink-0 items-center justify-center text-primary"><Icon className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{r.title}</h3>
          <p className="mt-0.5 text-sm text-muted">{r.desc}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {r.filters.includes('class') && (
          <>
            <Select value={f.classId} onChange={(e) => setF({ ...f, classId: e.target.value, sectionId: '' })} placeholder={r.required?.includes('class') ? 'Select class *' : 'All classes'} options={classOptions} aria-label="Class" />
            <Select value={f.sectionId} onChange={(e) => setF({ ...f, sectionId: e.target.value })} placeholder="All sections" options={sectionOptionsFor(f.classId)} disabled={!f.classId} aria-label="Section" />
          </>
        )}
        {r.filters.includes('dates') && (
          <>
            <Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} aria-label="From date" />
            <Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} aria-label="To date" />
          </>
        )}
        {r.filters.includes('month') && <Input type="month" value={f.month} onChange={(e) => setF({ ...f, month: e.target.value })} aria-label="Month" />}
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {r.pdf && <Button icon={FileText} disabled={missing} onClick={() => openPdf(`/reports/export/${r.type}`, { ...params, format: 'pdf' })}>PDF</Button>}
        <Button variant="primary" icon={FileDown} disabled={missing} onClick={() => downloadFile(`/reports/export/${r.type}`, `${r.type}.xlsx`, params)}>Excel</Button>
      </div>
    </Card>
  );
}

export default function ReportsPage() {
  const { classOptions, classes } = useClassOptions();
  const canFees = usePermission('fees.view');
  const canAttendance = usePermission('attendance.view');
  const allowed = (r) => !r.needs || (r.needs === 'fees.view' ? canFees : canAttendance);
  const sectionOptionsFor = (classId) => (classes.find((c) => c.id === Number(classId))?.sections ?? []).map((s) => ({ value: s.id, label: s.name }));

  return (
    <>
      <PageHeader title="Reports" subtitle="All reports follow the session and medium selected at the top." />
      <div className="grid gap-5 lg:grid-cols-2">
        {REPORTS.filter(allowed).map((r) => <ReportCard key={r.type} r={r} classOptions={classOptions} sectionOptionsFor={sectionOptionsFor} />)}
      </div>
    </>
  );
}
