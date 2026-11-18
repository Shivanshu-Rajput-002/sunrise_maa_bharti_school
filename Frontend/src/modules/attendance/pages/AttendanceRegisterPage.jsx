import clsx from 'clsx';
import { FileDown } from 'lucide-react';
import { useState } from 'react';
import { useSelector } from 'react-redux';
import { useGetRegisterQuery } from '../../../api/opsApi';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import Loader from '../../../components/common/Loader';
import PageHeader from '../../../components/common/PageHeader';
import Input from '../../../components/form/Input';
import Select from '../../../components/form/Select';
import { usePermission } from '../../../hooks/usePermission';
import { selectScope } from '../../../store/slices/scopeSlice';
import { downloadFile } from '../../../utils/files';
import { useClassOptions } from '../../academic/hooks/useClassOptions';

const TONE = { P: 'text-success', A: 'text-danger font-semibold', L: 'text-warning', HD: 'text-primary' };

export default function AttendanceRegisterPage() {
  const scope = useSelector(selectScope);
  const [f, setF] = useState({ classId: '', sectionId: '', mediumId: scope.mediumId ? String(scope.mediumId) : '', month: new Date().toISOString().slice(0, 7) });
  const { classOptions, sectionOptions, mediumOptions } = useClassOptions(f.classId);
  const ready = f.classId && f.month;
  const { data, isFetching } = useGetRegisterQuery({ classId: f.classId, sectionId: f.sectionId || undefined, mediumId: f.mediumId || undefined, month: f.month }, { skip: !ready });
  const canExport = usePermission('reports.export');
  const days = data ? Array.from({ length: data.days }, (_, i) => i + 1) : [];

  return (
    <>
      <PageHeader
        title="Attendance register"
        subtitle="Monthly view: P present · A absent · L leave · ½ half day"
        actions={canExport && ready && <Button icon={FileDown} onClick={() => downloadFile('/reports/export/attendance', `attendance-${f.month}.xlsx`, { classId: f.classId, sectionId: f.sectionId || undefined, month: f.month })}>Export Excel</Button>}
      />
      <Card className="mb-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input label="Month" type="month" value={f.month} onChange={(e) => setF({ ...f, month: e.target.value })} />
          <Select label="Medium" value={f.mediumId} onChange={(e) => setF({ ...f, mediumId: e.target.value })} placeholder="All mediums" options={mediumOptions} />
          <Select label="Class" value={f.classId} onChange={(e) => setF({ ...f, classId: e.target.value, sectionId: '' })} placeholder="Select class" options={classOptions} />
          <Select label="Section" value={f.sectionId} onChange={(e) => setF({ ...f, sectionId: e.target.value })} placeholder="All sections" options={sectionOptions} disabled={!f.classId} />
        </div>
      </Card>
      {ready && isFetching && !data && <Loader />}
      {data && (
        <Card bodyClassName="p-3">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted">
                  <th className="sticky left-0 z-10 bg-base px-2 py-2 text-left font-medium">Student</th>
                  {days.map((d) => (
                    <th key={d} className={clsx('w-7 px-0.5 py-2 text-center font-medium', data.offDays[d] && 'text-muted/50')} title={data.offDays[d]}>{d}</th>
                  ))}
                  <th className="px-2 py-2 text-right font-medium">P</th>
                  <th className="px-2 py-2 text-right font-medium">A</th>
                  <th className="px-2 py-2 text-right font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.enrollmentId} className="border-t border-line/60">
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-base px-2 py-1.5"><span className="mr-1 text-muted">{r.rollNo ?? ''}</span>{r.student.name}</td>
                    {days.map((d) => (
                      <td key={d} className={clsx('px-0.5 py-1.5 text-center', data.offDays[d] && 'bg-line/40', TONE[r.days[d]])}>
                        {r.days[d] === 'HD' ? '½' : r.days[d] ?? (data.offDays[d] ? '·' : '')}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-right tabular-nums">{r.present}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{r.absent}</td>
                    <td className={clsx('px-2 py-1.5 text-right tabular-nums', r.percent != null && r.percent < 75 && 'font-semibold text-danger')}>{r.percent ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.rows.length && <p className="py-8 text-center text-sm text-muted">No students in this class.</p>}
          </div>
          <p className="mt-3 px-2 text-xs text-muted">Shaded columns are Sundays / holidays. Below 75% is highlighted.</p>
        </Card>
      )}
    </>
  );
}
