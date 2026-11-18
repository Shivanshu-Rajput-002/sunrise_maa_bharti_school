import clsx from 'clsx';
import { CheckCheck, Fingerprint, Save, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux';
import { useGetAttendanceSheetQuery, useMarkAttendanceMutation } from '../../../api/opsApi';
import { baseApi } from '../../../app/store/baseApi';
import Avatar from '../../../components/common/Avatar';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import Loader from '../../../components/common/Loader';
import Modal from '../../../components/common/Modal';
import PageHeader from '../../../components/common/PageHeader';
import Input from '../../../components/form/Input';
import Select from '../../../components/form/Select';
import { usePermission } from '../../../hooks/usePermission';
import { selectScope } from '../../../store/slices/scopeSlice';
import { uploadFile } from '../../../utils/files';
import { useClassOptions } from '../../academic/hooks/useClassOptions';

const STATUSES = [
  { v: 'P', label: 'P', title: 'Present', on: 'bg-success text-white' },
  { v: 'A', label: 'A', title: 'Absent', on: 'bg-danger text-white' },
  { v: 'L', label: 'L', title: 'Leave', on: 'bg-warning text-white' },
  { v: 'HD', label: '½', title: 'Half day', on: 'bg-primary text-white' },
];

export default function MarkAttendancePage() {
  const dispatch = useDispatch();
  const scope = useSelector(selectScope);
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ classId: '', sectionId: '', mediumId: scope.mediumId ? String(scope.mediumId) : '', date: today });
  const { classOptions, sectionOptions, mediumOptions } = useClassOptions(f.classId);
  const ready = f.classId && f.date;
  const { data, isFetching, isError, error } = useGetAttendanceSheetQuery(
    { classId: f.classId, sectionId: f.sectionId || undefined, mediumId: f.mediumId || undefined, date: f.date },
    { skip: !ready },
  );
  const [mark, m] = useMarkAttendanceMutation();
  const [marks, setMarks] = useState({});
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef(null);
  const canMark = usePermission('attendance.mark');
  const canUpload = usePermission('attendance.upload');

  useEffect(() => {
    setMarks(Object.fromEntries((data?.rows ?? []).filter((r) => r.status).map((r) => [r.enrollmentId, r.status])));
  }, [data]);

  const rows = data?.rows ?? [];
  const count = (s) => Object.values(marks).filter((x) => x === s).length;
  const dirty = rows.some((r) => (marks[r.enrollmentId] ?? null) !== r.status);

  const save = async () => {
    const records = rows.filter((r) => marks[r.enrollmentId]).map((r) => ({ enrollmentId: r.enrollmentId, status: marks[r.enrollmentId] }));
    if (!records.length) return toast.error('Mark at least one student');
    try {
      await mark({ date: f.date, records }).unwrap();
      toast.success(`Attendance saved for ${records.length} students`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const onImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    try {
      const res = await uploadFile('/attendance/import', file);
      setImportResult(res);
      dispatch(baseApi.util.invalidateTags(['Attendance', 'Dashboard']));
    } catch (err) {
      toast.error(err.message);
    }
    setImporting(false);
  };

  return (
    <>
      <PageHeader
        title="Mark attendance"
        subtitle="Biometric punches appear automatically; marks you save here override them."
        actions={canUpload && <Button icon={Upload} onClick={() => setImportOpen(true)}>Upload Excel</Button>}
      />
      <Card className="mb-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input label="Date" type="date" max={today} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          <Select label="Medium" value={f.mediumId} onChange={(e) => setF({ ...f, mediumId: e.target.value })} placeholder="All mediums" options={mediumOptions} />
          <Select label="Class" value={f.classId} onChange={(e) => setF({ ...f, classId: e.target.value, sectionId: '' })} placeholder="Select class" options={classOptions} />
          <Select label="Section" value={f.sectionId} onChange={(e) => setF({ ...f, sectionId: e.target.value })} placeholder="All sections" options={sectionOptions} disabled={!f.classId} />
        </div>
      </Card>

      {ready && isFetching && !data && <Loader />}
      {isError && <Card><p className="text-sm text-danger">{error?.message}</p></Card>}
      {data && (
        <Card
          title={`${rows.length} students`}
          subtitle={`Present ${count('P')} · Absent ${count('A')} · Leave ${count('L')} · Half day ${count('HD')} · Unmarked ${rows.length - Object.keys(marks).length}`}
          actions={
            canMark && (
              <>
                <Button size="sm" icon={CheckCheck} onClick={() => setMarks(Object.fromEntries(rows.map((r) => [r.enrollmentId, marks[r.enrollmentId] ?? 'P'])))}>Rest present</Button>
                <Button size="sm" onClick={() => setMarks(Object.fromEntries(rows.map((r) => [r.enrollmentId, 'P'])))}>All present</Button>
                <Button variant="primary" size="sm" icon={Save} disabled={!dirty} loading={m.isLoading} onClick={save}>Save</Button>
              </>
            )
          }
        >
          {data.holiday && <p className="mb-4 rounded-xl px-4 py-3 text-sm text-warning shadow-neu-in-sm">{data.holiday} — this day is a holiday.</p>}
          <ul className="grid gap-3 md:grid-cols-2">
            {rows.map((r) => (
              <li key={r.enrollmentId} className="flex items-center gap-3 rounded-2xl px-3 py-2 shadow-neu-in-sm">
                <span className="w-7 text-center text-xs tabular-nums text-muted">{r.rollNo ?? '—'}</span>
                <Avatar name={r.student.name} photoPath={r.student.photoPath} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.student.name}</span>
                  <span className="flex items-center gap-1 text-xs text-muted">
                    {r.student.admissionNo}
                    {r.source === 'biometric' && <span className="inline-flex items-center gap-0.5 text-primary"><Fingerprint className="h-3 w-3" /> {r.inTime?.slice(0, 5)}</span>}
                  </span>
                </span>
                <span className="flex gap-1" role="radiogroup" aria-label={`Attendance for ${r.student.name}`}>
                  {STATUSES.map((s) => (
                    <button
                      key={s.v}
                      role="radio"
                      aria-checked={marks[r.enrollmentId] === s.v}
                      title={s.title}
                      disabled={!canMark}
                      onClick={() => setMarks({ ...marks, [r.enrollmentId]: s.v })}
                      className={clsx('h-8 w-8 rounded-lg text-xs font-semibold transition', marks[r.enrollmentId] === s.v ? `${s.on} shadow-neu-sm` : 'text-muted shadow-neu-sm hover:text-ink')}
                    >
                      {s.label}
                    </button>
                  ))}
                </span>
              </li>
            ))}
          </ul>
          {!rows.length && <p className="py-8 text-center text-sm text-muted">No students in this class.</p>}
        </Card>
      )}

      <Modal open={importOpen} onClose={() => { setImportOpen(false); setImportResult(null); }} title="Upload attendance from Excel">
        <p className="text-sm text-muted">Columns (first row is the header):</p>
        <p className="mt-2 rounded-xl px-4 py-3 font-mono text-xs shadow-neu-in-sm">Admission No | Date (YYYY-MM-DD) | Status (P / A / L / HD)</p>
        <div className="mt-4">
          <Button variant="primary" icon={Upload} loading={importing} onClick={() => fileRef.current?.click()}>Choose .xlsx file</Button>
          <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={onImport} />
        </div>
        {importResult && (
          <div className="mt-4 text-sm">
            <p className="font-medium text-success">{importResult.saved} marks saved</p>
            {importResult.errorCount > 0 && (
              <>
                <p className="mt-2 text-danger">{importResult.errorCount} rows skipped:</p>
                <ul className="mt-1 max-h-48 list-disc overflow-y-auto pl-5 text-xs text-muted">{importResult.errors.map((x) => <li key={x}>{x}</li>)}</ul>
              </>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
