import { ListOrdered } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useSelector } from 'react-redux';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import DataTable from '../../../components/common/DataTable';
import PageHeader from '../../../components/common/PageHeader';
import Select from '../../../components/form/Select';
import { selectScope } from '../../../store/slices/scopeSlice';
import { useClassOptions } from '../../academic/hooks/useClassOptions';
import { useAssignRollsMutation, useGetStudentsQuery } from '../services/studentsApi';

export default function RollNumbersPage() {
  const scope = useSelector(selectScope);
  const [f, setF] = useState({ classId: '', sectionId: '', mediumId: scope.mediumId ?? '', orderBy: 'name' });
  const [confirm, setConfirm] = useState(false);
  const { classOptions, sectionOptions, mediumOptions } = useClassOptions(f.classId);
  const [assign, { isLoading }] = useAssignRollsMutation();
  const ready = f.classId && f.mediumId;

  // Medium must be explicit here even when the header says "All"
  const { data, isFetching } = useGetStudentsQuery(
    { mediumId: f.mediumId, classId: f.classId, sectionId: f.sectionId || undefined, limit: 200, enrollmentStatus: 'studying', sortBy: 'rollNo' },
    { skip: !ready },
  );
  // "No section" means students without a section (the backend numbers exactly that group)
  const rows = (data?.items ?? []).filter((e) => (f.sectionId ? true : !e.sectionId));

  const run = async () => {
    try {
      const res = await assign({
        classId: Number(f.classId),
        sectionId: f.sectionId ? Number(f.sectionId) : null,
        mediumId: Number(f.mediumId),
        orderBy: f.orderBy,
      }).unwrap();
      toast.success(`Roll numbers assigned to ${res.updated} students`);
      setConfirm(false);
    } catch (e) {
      toast.error(e.message);
      setConfirm(false);
    }
  };

  return (
    <>
      <PageHeader title="Roll numbers" subtitle="Re-number a class section 1, 2, 3… in alphabetical or admission order." />
      <Card>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Select label="Medium" value={f.mediumId} onChange={(e) => setF({ ...f, mediumId: e.target.value })} placeholder="Select medium" options={mediumOptions} />
          <Select label="Class" value={f.classId} onChange={(e) => setF({ ...f, classId: e.target.value, sectionId: '' })} placeholder="Select class" options={classOptions} />
          <Select label="Section" value={f.sectionId} onChange={(e) => setF({ ...f, sectionId: e.target.value })} placeholder="No section" options={sectionOptions} disabled={!f.classId} />
          <Select
            label="Order by"
            value={f.orderBy}
            onChange={(e) => setF({ ...f, orderBy: e.target.value })}
            options={[
              { value: 'name', label: 'Student name (A–Z)' },
              { value: 'admission', label: 'Admission number' },
            ]}
          />
          <div className="flex items-end">
            <Button variant="primary" icon={ListOrdered} className="w-full justify-center" disabled={!ready || !rows.length} onClick={() => setConfirm(true)}>
              Assign
            </Button>
          </div>
        </div>
      </Card>

      {ready && (
        <Card className="mt-6" title="Current roll list" subtitle={`${rows.length} students`}>
          <DataTable
            loading={isFetching}
            rows={rows}
            columns={[
              { key: 'rollNo', header: 'Roll', className: 'w-20 tabular-nums', render: (e) => e.rollNo ?? <span className="text-warning">—</span> },
              { key: 'name', header: 'Student', render: (e) => e.student.name },
              { key: 'adm', header: 'Admission no.', render: (e) => e.student.admissionNo },
              { key: 'father', header: 'Father', render: (e) => e.student.fatherName ?? '—' },
            ]}
            empty="No studying students in this class"
          />
        </Card>
      )}

      <ConfirmDialog
        open={confirm}
        title="Re-assign roll numbers?"
        message={`Existing roll numbers of ${rows.length} students in this class will be replaced.`}
        confirmText="Assign"
        loading={isLoading}
        onConfirm={run}
        onClose={() => setConfirm(false)}
      />
    </>
  );
}
