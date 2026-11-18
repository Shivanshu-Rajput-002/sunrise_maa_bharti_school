import { Printer } from 'lucide-react';
import { useState } from 'react';
import { useGetExamsQuery } from '../../../api/opsApi';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import Input from '../../../components/form/Input';
import Select from '../../../components/form/Select';
import SegmentedControl from '../../../components/form/SegmentedControl';
import { openPdf } from '../../../utils/files';

const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

/**
 * Fee due slip (old school format) for a class, or for one student.
 * target: { classId, sectionId } or { enrollmentId, name }
 */
export default function DueSlipModal({ target, onClose }) {
  const { data: exams = [] } = useGetExamsQuery();
  const upcoming = exams.filter((e) => !e.startDate || e.startDate >= new Date().toISOString().slice(0, 10));
  const [f, setF] = useState({ examId: upcoming[0]?.id ? String(upcoming[0].id) : '', examDate: '', lastDate: inDays(7), basis: 'overdue' });
  const exam = exams.find((e) => String(e.id) === f.examId);

  const print = () => {
    openPdf(
      '/fees/due-slips/pdf',
      {
        ...(target.enrollmentId ? { enrollmentIds: String(target.enrollmentId) } : { classId: target.classId, sectionId: target.sectionId || undefined }),
        examId: f.examId || undefined,
        examDate: f.examDate || undefined,
        lastDate: f.lastDate,
        basis: f.basis,
      },
      target.enrollmentId ? `Fee due slip · ${target.name}` : 'Fee due slips',
    );
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={target.enrollmentId ? `Fee due slip · ${target.name}` : 'Fee due slips for the class'}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon={Printer} disabled={!f.lastDate} onClick={print}>Show & print</Button></>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Upcoming test / exam" className="sm:col-span-2" value={f.examId} onChange={(e) => setF({ ...f, examId: e.target.value, examDate: '' })} placeholder="No exam (only fee reminder)" options={exams.map((e) => ({ value: e.id, label: e.name }))} />
        <Input label="Exam starts on" type="date" value={f.examDate || exam?.startDate || ''} disabled={!f.examId} onChange={(e) => setF({ ...f, examDate: e.target.value })} hint={f.examId && !exam?.startDate ? 'Exam has no start date — enter it here' : undefined} />
        <Input label="Pay by (last date)" type="date" required value={f.lastDate} onChange={(e) => setF({ ...f, lastDate: e.target.value })} />
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-sm font-medium">Amount on the slip</p>
          <SegmentedControl
            value={f.basis}
            onChange={(v) => setF({ ...f, basis: v })}
            ariaLabel="Amount on the slip"
            options={[
              { value: 'overdue', label: 'Due till today' },
              { value: 'total', label: 'Full-year balance' },
            ]}
          />
        </div>
      </div>
      <p className="mt-4 text-xs text-muted">Slips are made only for students who have pending fees. 3 slips per A4 page.</p>
    </Modal>
  );
}
