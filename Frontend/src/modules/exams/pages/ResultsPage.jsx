import clsx from 'clsx';
import { ClipboardEdit, FileText, IdCard, Trophy } from 'lucide-react';
import { useState } from 'react';
import { useSelector } from 'react-redux';
import { useGetExamsQuery, useGetResultQuery } from '../../../api/opsApi';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import Loader from '../../../components/common/Loader';
import PageHeader from '../../../components/common/PageHeader';
import Select from '../../../components/form/Select';
import { selectScope } from '../../../store/slices/scopeSlice';
import { openPdf } from '../../../utils/files';
import { useClassOptions } from '../../academic/hooks/useClassOptions';
import MarksheetExtrasModal from '../components/MarksheetExtrasModal';

export default function ResultsPage() {
  const scope = useSelector(selectScope);
  const [f, setF] = useState({ examId: '', classId: '', sectionId: '', mediumId: scope.mediumId ? String(scope.mediumId) : '' });
  const { data: exams = [] } = useGetExamsQuery();
  const { classOptions, sectionOptions, mediumOptions } = useClassOptions(f.classId);
  const ready = f.examId && f.classId;
  const params = { classId: f.classId, sectionId: f.sectionId || undefined, mediumId: f.mediumId || undefined };
  const { data, isFetching } = useGetResultQuery({ examId: f.examId, ...params }, { skip: !ready });
  const [extras, setExtras] = useState(null);

  return (
    <>
      <PageHeader
        title="Results & report cards"
        subtitle="Class result for one exam. Marksheets combine the exams mapped to marksheet columns (Exams → Edit)."
        actions={
          f.classId && (
            <>
              {f.examId && <Button icon={IdCard} onClick={() => openPdf(`/exams/${f.examId}/admit-cards/pdf`, params, 'Admit cards')}>Admit cards</Button>}
              <Button variant="primary" icon={FileText} onClick={() => openPdf('/exams/report-cards/pdf', params, 'Marksheets')}>Marksheets</Button>
            </>
          )
        }
      />
      <Card className="mb-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select label="Exam" value={f.examId} onChange={(e) => setF({ ...f, examId: e.target.value })} placeholder="Select exam" options={exams.map((x) => ({ value: x.id, label: x.name }))} />
          <Select label="Class" value={f.classId} onChange={(e) => setF({ ...f, classId: e.target.value, sectionId: '' })} placeholder="Select class" options={classOptions} />
          <Select label="Medium" value={f.mediumId} onChange={(e) => setF({ ...f, mediumId: e.target.value })} placeholder="All mediums" options={mediumOptions} />
          <Select label="Section" value={f.sectionId} onChange={(e) => setF({ ...f, sectionId: e.target.value })} placeholder="All sections" options={sectionOptions} disabled={!f.classId} />
        </div>
      </Card>
      {ready && isFetching && !data && <Loader />}
      {data && (
        <Card title={`${data.exam.name} · ${data.rows.length} students`} subtitle={`Maximum ${data.maxTotal} marks`} bodyClassName="p-3">
          {!data.subjects.length ? (
            <p className="py-8 text-center text-sm text-warning">No timetable for this class yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-muted">
                    <th className="px-2 py-2 text-left">Rank</th>
                    <th className="px-2 py-2 text-left">Student</th>
                    {data.subjects.map((s) => <th key={s.scheduleId} className="px-2 py-2 text-right">{s.subject}<span className="block text-[10px] normal-case">/{s.maxMarks}</span></th>)}
                    <th className="px-2 py-2 text-right">Total</th>
                    <th className="px-2 py-2 text-right">%</th>
                    <th className="px-2 py-2">Grade</th>
                    <th className="px-2 py-2">Result</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.enrollmentId} className="border-t border-line/60">
                      <td className="px-2 py-1.5">{r.rank ? <span className={clsx('inline-flex items-center gap-1 font-semibold', r.rank <= 3 && 'text-warning')}>{r.rank <= 3 && <Trophy className="h-3.5 w-3.5" />}{r.rank}</span> : '—'}</td>
                      <td className="px-2 py-1.5"><span className="mr-1 text-xs text-muted">{r.rollNo ?? ''}</span>{r.student.name}</td>
                      {r.subjects.map((s, i) => (
                        <td key={s.scheduleId} className={clsx('px-2 py-1.5 text-right tabular-nums', s.absent && 'text-danger', s.marks != null && s.marks < data.subjects[i].passMarks && 'text-danger')}>
                          {s.absent ? 'AB' : s.marks ?? '·'}
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{r.total}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{r.percent}</td>
                      <td className="px-2 py-1.5 text-center">{r.grade}</td>
                      <td className="px-2 py-1.5 text-center"><Badge tone={r.result === 'Pass' ? 'success' : r.result === 'Fail' ? 'danger' : 'neutral'}>{r.result}</Badge></td>
                      <td className="px-2 py-1.5 text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button size="icon-sm" icon={ClipboardEdit} aria-label="Marksheet details" title="SUPW / Art / grades / health" onClick={() => setExtras(r)} />
                          <Button size="icon-sm" icon={FileText} aria-label="Marksheet" title="Marksheet PDF" onClick={() => openPdf(`/exams/report-card/${r.enrollmentId}/pdf`, undefined, `Marksheet · ${r.student.name}`)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
      {extras && <MarksheetExtrasModal row={extras} onClose={() => setExtras(null)} />}
    </>
  );
}
