import { IdCard, Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { useGetExamsQuery } from '../../../api/opsApi';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import PageHeader from '../../../components/common/PageHeader';
import Select from '../../../components/form/Select';
import { selectScope } from '../../../store/slices/scopeSlice';
import { openPdf } from '../../../utils/files';
import { formatDate } from '../../../utils/format';
import { useClassOptions } from '../../academic/hooks/useClassOptions';

/** Admit cards for one class or the whole school (every class with this exam's timetable) */
export default function AdmitCardsPage() {
  const scope = useSelector(selectScope);
  const { data: exams = [], isLoading } = useGetExamsQuery();
  const [f, setF] = useState({ examId: '', classId: '', sectionId: '', mediumId: scope.mediumId ? String(scope.mediumId) : '' });
  const { classOptions, sectionOptions, mediumOptions } = useClassOptions(f.classId);
  const exam = exams.find((e) => String(e.id) === f.examId);

  // Pre-pick the next upcoming exam
  useEffect(() => {
    if (f.examId || !exams.length) return;
    const today = new Date().toISOString().slice(0, 10);
    const next = exams.find((e) => e.startDate && e.startDate >= today) ?? exams[exams.length - 1];
    setF((x) => ({ ...x, examId: String(next.id) }));
  }, [exams, f.examId]);

  const print = () =>
    openPdf(
      `/exams/${f.examId}/admit-cards/pdf`,
      { classId: f.classId || undefined, sectionId: f.sectionId || undefined, mediumId: f.mediumId || undefined },
      `Admit cards · ${exam?.name ?? ''}${f.classId ? ` · Class ${classOptions.find((c) => String(c.value) === f.classId)?.label ?? ''}` : ' · All classes'}`,
    );

  return (
    <>
      <PageHeader title="Admit cards" subtitle="Print admit cards for one class or for all classes at once (2 cards per A4 page, in class order)." />
      <Card>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select label="Exam" value={f.examId} onChange={(e) => setF({ ...f, examId: e.target.value })} placeholder={isLoading ? 'Loading…' : 'Select exam'} options={exams.map((x) => ({ value: x.id, label: x.name }))} />
          <Select label="Class" value={f.classId} onChange={(e) => setF({ ...f, classId: e.target.value, sectionId: '' })} placeholder="All classes" options={classOptions} />
          <Select label="Section" value={f.sectionId} onChange={(e) => setF({ ...f, sectionId: e.target.value })} placeholder="All sections" options={sectionOptions} disabled={!f.classId} />
          <Select label="Medium" value={f.mediumId} onChange={(e) => setF({ ...f, mediumId: e.target.value })} placeholder="All mediums" options={mediumOptions} />
        </div>

        {exam && (
          <p className="mt-4 text-sm text-muted">
            {exam.name}
            {exam.startDate ? ` · ${formatDate(exam.startDate)} – ${formatDate(exam.endDate)}` : ''}
            {' · '}
            {f.classId ? 'one class' : 'all classes that have a timetable for this exam'}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button variant="primary" size="lg" icon={f.classId ? IdCard : Printer} disabled={!f.examId} onClick={print}>
            {f.classId ? 'Show & print class admit cards' : 'Show & print ALL admit cards'}
          </Button>
          <span className="text-xs text-muted">Printing every class can take a minute for a big school.</span>
        </div>

        <div className="mt-6 rounded-2xl p-4 text-sm text-muted shadow-neu-in-sm">
          <p className="font-medium text-ink">Before printing</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>Add the timetable for each class in <Link to="/exams" className="text-primary">Exams → Timetable</Link> — classes without a timetable are skipped.</li>
            <li>Notes printed at the bottom (holiday, exam interval…) are set in Exams → Edit exam → Admit card notes.</li>
            <li>Student photos come from the student profile.</li>
          </ul>
        </div>
      </Card>
    </>
  );
}
