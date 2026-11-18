import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useSelector } from 'react-redux';
import { useGetExamsQuery, useGetMarksQuery, useGetScheduleQuery, useSaveMarksMutation } from '../../../api/opsApi';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import Loader from '../../../components/common/Loader';
import PageHeader from '../../../components/common/PageHeader';
import Select from '../../../components/form/Select';
import { usePermission } from '../../../hooks/usePermission';
import { selectScope } from '../../../store/slices/scopeSlice';
import { useClassOptions } from '../../academic/hooks/useClassOptions';

export default function MarksEntryPage() {
  const scope = useSelector(selectScope);
  const [f, setF] = useState({ examId: '', classId: '', scheduleId: '', sectionId: '', mediumId: scope.mediumId ? String(scope.mediumId) : '' });
  const { data: exams = [] } = useGetExamsQuery();
  const { classOptions, sectionOptions, mediumOptions } = useClassOptions(f.classId);
  const { data: schedule = [] } = useGetScheduleQuery({ examId: f.examId, classId: f.classId }, { skip: !f.examId || !f.classId });
  const { data, isFetching } = useGetMarksQuery({ scheduleId: f.scheduleId, sectionId: f.sectionId || undefined, mediumId: f.mediumId || undefined }, { skip: !f.scheduleId });
  const [save, s] = useSaveMarksMutation();
  const [rows, setRows] = useState({});
  const canEnter = usePermission('exams.marks');

  useEffect(() => {
    setRows(Object.fromEntries((data?.rows ?? []).map((r) => [r.enrollmentId, { marks: r.marks ?? '', pr: r.practicalMarks ?? '', isAbsent: r.isAbsent, remarks: r.remarks ?? '' }])));
  }, [data]);

  const max = data ? Number(data.schedule.maxMarks) : 0;
  const pass = data ? Number(data.schedule.passMarks) : 0;
  /** Practical max (class 11-12 subjects); marks then = theory */
  const pMax = data?.schedule.practicalMax != null ? Number(data.schedule.practicalMax) : null;
  const badTh = (r) => !r.isAbsent && r.marks !== '' && (Number(r.marks) > max || Number(r.marks) < 0);
  const badPr = (r) => pMax != null && !r.isAbsent && r.pr !== '' && (Number(r.pr) > pMax || Number(r.pr) < 0);
  const invalid = Object.values(rows).some((r) => badTh(r) || badPr(r));

  const submit = async () => {
    if (invalid) return toast.error(pMax != null ? `Theory 0–${max}, practical 0–${pMax}` : `Marks must be between 0 and ${max}`);
    const records = Object.entries(rows)
      .filter(([, r]) => r.isAbsent || r.marks !== '' || (pMax != null && r.pr !== ''))
      .map(([id, r]) => ({
        enrollmentId: Number(id),
        marks: r.isAbsent || r.marks === '' ? null : Number(r.marks),
        practicalMarks: pMax == null || r.isAbsent || r.pr === '' ? null : Number(r.pr),
        isAbsent: r.isAbsent,
        remarks: r.remarks || undefined,
      }));
    if (!records.length) return toast.error('Enter marks for at least one student');
    try {
      await save({ scheduleId: Number(f.scheduleId), records }).unwrap();
      toast.success(`Marks saved for ${records.length} students`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  // Enter moves to the next marks box — fast keyboard entry
  const onKey = (e, idx, attr = 'data-mark-idx') => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.querySelector(`[${attr}="${idx + 1}"]`)?.focus();
    }
  };

  return (
    <>
      <PageHeader title="Marks entry" subtitle="Pick exam, class and subject. Press Enter to jump to the next student." />
      <Card className="mb-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Select label="Exam" value={f.examId} onChange={(e) => setF({ ...f, examId: e.target.value, scheduleId: '' })} placeholder="Select exam" options={exams.map((x) => ({ value: x.id, label: x.name }))} />
          <Select label="Class" value={f.classId} onChange={(e) => setF({ ...f, classId: e.target.value, scheduleId: '', sectionId: '' })} placeholder="Select class" options={classOptions} />
          <Select label="Subject" value={f.scheduleId} onChange={(e) => setF({ ...f, scheduleId: e.target.value })} placeholder={f.classId && !schedule.length ? 'No timetable' : 'Select subject'} options={schedule.map((x) => ({ value: x.id, label: `${x.subject?.name} (/${Number(x.maxMarks)}${x.practicalMax != null ? ` + ${Number(x.practicalMax)} pr` : ''})` }))} disabled={!schedule.length} />
          <Select label="Medium" value={f.mediumId} onChange={(e) => setF({ ...f, mediumId: e.target.value })} placeholder="All mediums" options={mediumOptions} />
          <Select label="Section" value={f.sectionId} onChange={(e) => setF({ ...f, sectionId: e.target.value })} placeholder="All sections" options={sectionOptions} disabled={!f.classId} />
        </div>
      </Card>

      {f.scheduleId && isFetching && !data && <Loader />}
      {data && (
        <Card
          title={`${data.schedule.subject?.name} · Class ${data.schedule.schoolClass?.name}`}
          subtitle={`${pMax != null ? `Theory ${max} + Practical ${pMax}` : `Max ${max}`} · Pass ${pass} · ${data.rows.length} students`}
          actions={canEnter && <Button variant="primary" icon={Save} loading={s.isLoading} disabled={invalid} onClick={submit}>Save marks</Button>}
        >
          <div className="neu-inset overflow-x-auto p-1">
            <table className="w-full min-w-[560px] text-sm">
              <thead><tr className="text-xs uppercase tracking-wide text-muted"><th className="px-3 py-2 text-left">Roll</th><th className="px-3 py-2 text-left">Student</th><th className="px-3 py-2 text-left">{pMax != null ? 'Theory' : 'Marks'}</th>{pMax != null && <th className="px-3 py-2 text-left">Practical</th>}<th className="px-3 py-2">Absent</th><th className="px-3 py-2 text-left">Remarks</th></tr></thead>
              <tbody>
                {data.rows.map((r, idx) => {
                  const v = rows[r.enrollmentId] ?? { marks: '', pr: '', isAbsent: false, remarks: '' };
                  const bad = badTh(v);
                  const fail = !v.isAbsent && v.marks !== '' && Number(v.marks) + (pMax != null && v.pr !== '' ? Number(v.pr) : 0) < pass;
                  return (
                    <tr key={r.enrollmentId} className="border-t border-line/60">
                      <td className="px-3 py-1.5 tabular-nums text-muted">{r.rollNo ?? '—'}</td>
                      <td className="px-3 py-1.5">{r.student.name}<span className="ml-1 text-xs text-muted">{r.section ? `(${r.section.name})` : ''}</span></td>
                      <td className="w-32 px-3 py-1.5">
                        <input
                          data-mark-idx={idx}
                          type="number"
                          min={0}
                          max={max}
                          step="0.5"
                          disabled={v.isAbsent || !canEnter}
                          value={v.isAbsent ? '' : v.marks}
                          onKeyDown={(e) => onKey(e, idx)}
                          onChange={(e) => setRows({ ...rows, [r.enrollmentId]: { ...v, marks: e.target.value } })}
                          className={`w-full rounded-lg bg-base px-2 py-1.5 text-right tabular-nums shadow-neu-in-sm outline-none ${bad ? 'text-danger ring-2 ring-danger/50' : fail ? 'text-warning' : ''}`}
                          aria-label={`Marks for ${r.student.name}`}
                        />
                      </td>
                      {pMax != null && (
                        <td className="w-28 px-3 py-1.5">
                          <input
                            data-pr-idx={idx}
                            type="number"
                            min={0}
                            max={pMax}
                            step="0.5"
                            disabled={v.isAbsent || !canEnter}
                            value={v.isAbsent ? '' : v.pr}
                            onKeyDown={(e) => onKey(e, idx, 'data-pr-idx')}
                            onChange={(e) => setRows({ ...rows, [r.enrollmentId]: { ...v, pr: e.target.value } })}
                            className={`w-full rounded-lg bg-base px-2 py-1.5 text-right tabular-nums shadow-neu-in-sm outline-none ${badPr(v) ? 'text-danger ring-2 ring-danger/50' : ''}`}
                            aria-label={`Practical marks for ${r.student.name}`}
                          />
                        </td>
                      )}
                      <td className="px-3 py-1.5 text-center"><input type="checkbox" disabled={!canEnter} checked={v.isAbsent} onChange={(e) => setRows({ ...rows, [r.enrollmentId]: { ...v, isAbsent: e.target.checked } })} className="h-4 w-4 accent-[rgb(var(--primary))]" aria-label={`${r.student.name} absent`} /></td>
                      <td className="px-3 py-1.5"><input disabled={!canEnter} value={v.remarks} maxLength={150} onChange={(e) => setRows({ ...rows, [r.enrollmentId]: { ...v, remarks: e.target.value } })} className="w-full rounded-lg bg-base px-2 py-1.5 shadow-neu-in-sm outline-none" aria-label={`Remarks for ${r.student.name}`} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
