import { CalendarClock, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  useCreateExamMutation,
  useDeleteExamMutation,
  useGetExamsQuery,
  useGetScheduleQuery,
  useSaveScheduleMutation,
  useUpdateExamMutation,
} from '../../../api/opsApi';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import DataTable from '../../../components/common/DataTable';
import Modal from '../../../components/common/Modal';
import PageHeader from '../../../components/common/PageHeader';
import Input from '../../../components/form/Input';
import Select from '../../../components/form/Select';
import Switch from '../../../components/form/Switch';
import { usePermission } from '../../../hooks/usePermission';
import { formatDate } from '../../../utils/format';
import { useClassOptions } from '../../academic/hooks/useClassOptions';
import { useGetSubjectsQuery } from '../../academic/services/academicApi';

export const EXAM_TYPES = [
  { value: 'class_test', label: 'Class test' },
  { value: 'unit_test', label: 'Unit test' },
  { value: 'term', label: 'Term (half yearly)' },
  { value: 'annual', label: 'Annual' },
];
const typeLabel = Object.fromEntries(EXAM_TYPES.map((t) => [t.value, t.label]));

/** Where the exam prints on the old-format marksheet */
const COL_HI = [
  { value: '', label: 'Not on marksheet' },
  { value: 'T1', label: 'First Test' },
  { value: 'T2', label: 'Second Test' },
  { value: 'T3', label: 'Third Test' },
  { value: 'HY', label: 'Half Yearly' },
  { value: 'AN', label: 'Annual' },
];
const COL_EN = [
  { value: '', label: 'Not on marksheet' },
  { value: 'FA1', label: 'Term-1 · FA-1' },
  { value: 'FA2', label: 'Term-1 · FA-2' },
  { value: 'SA1', label: 'Term-1 · SA-1' },
  { value: 'FA3', label: 'Term-2 · FA-3' },
  { value: 'FA4', label: 'Term-2 · FA-4' },
  { value: 'SA2', label: 'Term-2 · SA-2' },
];
const colLabel = Object.fromEntries([...COL_HI, ...COL_EN].filter((c) => c.value).map((c) => [c.value, c.label]));

function ExamForm({ initial, onClose }) {
  const [create, c] = useCreateExamMutation();
  const [update, u] = useUpdateExamMutation();
  const [f, setF] = useState({
    name: initial?.name ?? '',
    type: initial?.type ?? 'unit_test',
    startDate: initial?.startDate ?? '',
    endDate: initial?.endDate ?? '',
    includeInReport: initial?.includeInReport ?? true,
    reportColumn: initial?.reportColumn ?? '',
    reportColumnEn: initial?.reportColumnEn ?? '',
    resultDate: initial?.resultDate ?? '',
    instructions: initial?.instructions ?? '',
  });
  const save = async () => {
    try {
      const body = {
        name: f.name.trim(),
        type: f.type,
        startDate: f.startDate || undefined,
        endDate: f.endDate || undefined,
        includeInReport: f.includeInReport,
        reportColumn: f.reportColumn || null,
        reportColumnEn: f.reportColumnEn || null,
        resultDate: f.resultDate || null,
        instructions: f.instructions.trim() || null,
      };
      if (initial) await update({ id: initial.id, ...body }).unwrap();
      else await create(body).unwrap();
      toast.success('Exam saved');
      onClose();
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <Modal open onClose={onClose} title={initial ? 'Edit exam' : 'New exam'} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={c.isLoading || u.isLoading} disabled={f.name.trim().length < 2} onClick={save}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Name" required className="sm:col-span-2" placeholder="e.g. Half Yearly" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Select label="Type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} options={EXAM_TYPES} className="sm:col-span-2" />
        <Input label="Starts" type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} />
        <Input label="Ends" type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} />
        <div className="sm:col-span-2"><Switch checked={f.includeInReport} onChange={(v) => setF({ ...f, includeInReport: v })} label="Show on report card" /></div>
        <Select label="Marksheet column · Hindi medium" value={f.reportColumn} onChange={(e) => setF({ ...f, reportColumn: e.target.value })} options={COL_HI} />
        <Select label="Marksheet column · English medium" value={f.reportColumnEn} onChange={(e) => setF({ ...f, reportColumnEn: e.target.value })} options={COL_EN} />
        <Input label="Declaration date (marksheet)" type="date" value={f.resultDate} onChange={(e) => setF({ ...f, resultDate: e.target.value })} />
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium">Admit card notes <span className="font-normal text-muted">(one per line)</span></span>
          <textarea rows={4} maxLength={2000} className="neu-field resize-y" placeholder="One note per line, e.g. Everyone has to come in complete uniform." value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} />
        </label>
      </div>
    </Modal>
  );
}

function ScheduleModal({ exam, onClose }) {
  const [classId, setClassId] = useState('');
  const { classOptions } = useClassOptions();
  const { data: subjects = [] } = useGetSubjectsQuery();
  const { data: saved, isFetching } = useGetScheduleQuery({ examId: exam.id, classId }, { skip: !classId });
  const [save, s] = useSaveScheduleMutation();
  const [rows, setRows] = useState([]);
  const canManage = usePermission('exams.manage');

  useEffect(() => {
    setRows((saved ?? []).map((r) => ({ subjectId: String(r.subjectId), examDate: r.examDate ?? '', startTime: r.startTime?.slice(0, 5) ?? '', endTime: r.endTime?.slice(0, 5) ?? '', maxMarks: Number(r.maxMarks), practicalMax: r.practicalMax != null ? Number(r.practicalMax) : '', passMarks: Number(r.passMarks) })));
  }, [saved]);

  const add = () => setRows([...rows, { subjectId: '', examDate: '', startTime: '09:00', endTime: '12:00', maxMarks: rows[rows.length - 1]?.maxMarks ?? 100, practicalMax: rows[rows.length - 1]?.practicalMax ?? '', passMarks: rows[rows.length - 1]?.passMarks ?? 33 }]);
  const upd = (i, patch) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const submit = async () => {
    if (rows.some((r) => !r.subjectId)) return toast.error('Choose a subject in every row');
    try {
      await save({ examId: exam.id, classId: Number(classId), items: rows.map((r) => ({ subjectId: Number(r.subjectId), examDate: r.examDate || null, startTime: r.startTime || null, endTime: r.endTime || null, maxMarks: Number(r.maxMarks), practicalMax: r.practicalMax === '' || r.practicalMax == null ? null : Number(r.practicalMax), passMarks: Number(r.passMarks) })) }).unwrap();
      toast.success('Timetable saved');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const cell = 'w-full rounded-lg bg-base px-2 py-1.5 text-sm shadow-neu-in-sm outline-none';
  return (
    <Modal open onClose={onClose} title={`Timetable · ${exam.name}`} size="xl" footer={classId && canManage && <><Button icon={Plus} onClick={add}>Add subject</Button><Button variant="primary" icon={Save} loading={s.isLoading} onClick={submit}>Save timetable</Button></>}>
      <Select label="Class" value={classId} onChange={(e) => setClassId(e.target.value)} placeholder="Select class" options={classOptions} className="mb-4 sm:w-64" />
      {classId && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="text-xs text-muted"><th className="p-2 text-left">Subject</th><th className="p-2">Date</th><th className="p-2">From</th><th className="p-2">To</th><th className="p-2" title="Theory max (or full max if no practical)">Max</th><th className="p-2" title="Leave empty if the subject has no practical">Practical</th><th className="p-2">Pass</th><th /></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="p-1"><select className={cell} value={r.subjectId} disabled={!canManage} onChange={(e) => upd(i, { subjectId: e.target.value })}><option value="">Select</option>{subjects.map((s2) => <option key={s2.id} value={s2.id}>{s2.name}</option>)}</select></td>
                  <td className="p-1"><input type="date" className={cell} value={r.examDate} disabled={!canManage} onChange={(e) => upd(i, { examDate: e.target.value })} /></td>
                  <td className="p-1"><input type="time" className={cell} value={r.startTime} disabled={!canManage} onChange={(e) => upd(i, { startTime: e.target.value })} /></td>
                  <td className="p-1"><input type="time" className={cell} value={r.endTime} disabled={!canManage} onChange={(e) => upd(i, { endTime: e.target.value })} /></td>
                  <td className="w-20 p-1"><input type="number" min={1} className={cell} value={r.maxMarks} disabled={!canManage} onChange={(e) => upd(i, { maxMarks: e.target.value })} /></td>
                  <td className="w-20 p-1"><input type="number" min={1} placeholder="—" className={cell} value={r.practicalMax} disabled={!canManage} onChange={(e) => upd(i, { practicalMax: e.target.value })} /></td>
                  <td className="w-20 p-1"><input type="number" min={0} className={cell} value={r.passMarks} disabled={!canManage} onChange={(e) => upd(i, { passMarks: e.target.value })} /></td>
                  <td className="p-1">{canManage && <Button size="icon-sm" variant="danger" icon={Trash2} aria-label="Remove subject" onClick={() => setRows(rows.filter((_, j) => j !== i))} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isFetching && !rows.length && <p className="py-6 text-center text-sm text-muted">No subjects yet — click “Add subject”.</p>}
        </div>
      )}
    </Modal>
  );
}

export default function ExamsPage() {
  const { data = [], isLoading } = useGetExamsQuery();
  const [update] = useUpdateExamMutation();
  const [del, d] = useDeleteExamMutation();
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [scheduling, setScheduling] = useState(null);
  const canManage = usePermission('exams.manage');

  return (
    <>
      <PageHeader title="Exams" subtitle="Create exams, set the timetable per class, and publish results to parents." actions={canManage && <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>New exam</Button>} />
      <Card>
        <DataTable loading={isLoading} rows={data} columns={[
          { key: 'name', header: 'Exam', render: (e) => <span className="font-medium">{e.name}</span> },
          { key: 'type', header: 'Type', render: (e) => typeLabel[e.type] },
          { key: 'dates', header: 'Dates', render: (e) => (e.startDate ? `${formatDate(e.startDate)} – ${formatDate(e.endDate)}` : '—') },
          { key: 'report', header: 'Marksheet column', render: (e) => [e.reportColumn && `${colLabel[e.reportColumn]} (Hindi)`, e.reportColumnEn && `${colLabel[e.reportColumnEn]} (English)`].filter(Boolean).join(' · ') || '—' },
          { key: 'pub', header: 'Results to parents', render: (e) => canManage ? <Switch checked={e.isPublished} onChange={async (v) => { try { await update({ id: e.id, isPublished: v }).unwrap(); toast.success(v ? 'Published to parents' : 'Unpublished'); } catch (err) { toast.error(err.message); } }} /> : <Badge tone={e.isPublished ? 'success' : 'neutral'}>{e.isPublished ? 'Published' : 'Hidden'}</Badge> },
          { key: 'a', header: '', className: 'text-right', render: (e) => (
            <div className="flex justify-end gap-2">
              <Button size="sm" icon={CalendarClock} onClick={() => setScheduling(e)}>Timetable</Button>
              {canManage && <Button size="icon-sm" icon={Pencil} aria-label="Edit" onClick={() => setEditing(e)} />}
              {canManage && <Button size="icon-sm" variant="danger" icon={Trash2} aria-label="Delete" onClick={() => setDeleting(e)} />}
            </div>
          ) },
        ]} empty="No exams in this session" />
      </Card>
      {editing && <ExamForm initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {scheduling && <ScheduleModal exam={scheduling} onClose={() => setScheduling(null)} />}
      <ConfirmDialog open={!!deleting} title={`Delete ${deleting?.name}?`} message="Blocked if marks were already entered." loading={d.isLoading} onConfirm={async () => { try { await del({ id: deleting.id }).unwrap(); toast.success('Deleted'); setDeleting(null); } catch (e) { toast.error(e.message); } }} onClose={() => setDeleting(null)} />
    </>
  );
}
