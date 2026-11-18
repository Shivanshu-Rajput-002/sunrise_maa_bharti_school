import { ArrowLeft, Camera, IndianRupee, Pencil, Trash2, UserX } from 'lucide-react';
import StudentExtras from '../components/StudentExtras';
import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';
import Avatar from '../../../components/common/Avatar';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import DataTable from '../../../components/common/DataTable';
import Loader from '../../../components/common/Loader';
import Modal from '../../../components/common/Modal';
import PageHeader from '../../../components/common/PageHeader';
import Input from '../../../components/form/Input';
import Select from '../../../components/form/Select';
import { usePermission } from '../../../hooks/usePermission';
import { formatDate } from '../../../utils/format';
import {
  useDeleteStudentMutation,
  useGetStudentQuery,
  useUpdateStudentStatusMutation,
  useUploadStudentPhotoMutation,
} from '../services/studentsApi';

const STATUS = {
  active: { label: 'Active', tone: 'success' },
  left: { label: 'Left', tone: 'danger' },
  passed_out: { label: 'Passed out', tone: 'primary' },
  tc_issued: { label: 'TC issued', tone: 'warning' },
};
const ENR_TONE = { studying: 'success', promoted: 'primary', detained: 'warning', left: 'danger' };

function Info({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium">{value || '—'}</dd>
    </div>
  );
}

function StatusModal({ student, onClose }) {
  const [save, { isLoading }] = useUpdateStudentStatusMutation();
  const [form, setForm] = useState({
    status: student.status,
    leavingDate: student.leavingDate ?? new Date().toISOString().slice(0, 10),
    leavingReason: student.leavingReason ?? '',
    tcNo: student.tcNo ?? '',
  });
  const leaving = form.status !== 'active';

  const submit = async () => {
    try {
      await save({
        id: student.id,
        status: form.status,
        ...(leaving ? { leavingDate: form.leavingDate, leavingReason: form.leavingReason || undefined } : {}),
        ...(form.status === 'tc_issued' && form.tcNo ? { tcNo: form.tcNo } : {}),
      }).unwrap();
      toast.success('Status updated');
      onClose();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Change student status"
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={isLoading} onClick={submit}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="Status"
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value })}
          options={Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }))}
        />
        {leaving && (
          <>
            <Input label="Leaving date" type="date" value={form.leavingDate} onChange={(e) => setForm({ ...form, leavingDate: e.target.value })} />
            <Input label="Reason" value={form.leavingReason} onChange={(e) => setForm({ ...form, leavingReason: e.target.value })} />
          </>
        )}
        {form.status === 'tc_issued' && (
          <Input label="TC number" value={form.tcNo} onChange={(e) => setForm({ ...form, tcNo: e.target.value })} />
        )}
      </div>
    </Modal>
  );
}

export default function StudentProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: s, isLoading, isError, error } = useGetStudentQuery(Number(id));
  const [upload, up] = useUploadStudentPhotoMutation();
  const [del, d] = useDeleteStudentMutation();
  const [statusOpen, setStatusOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef(null);
  const canUpdate = usePermission('students.update');
  const canDelete = usePermission('students.delete');
  const canCollect = usePermission('fees.collect');

  if (isLoading) return <Loader />;
  if (isError) return <Card title="Student not found">{error?.message}</Card>;

  const e = s.currentEnrollment;
  const st = STATUS[s.status];

  const onPhoto = async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error('Photo must be under 2 MB');
    try {
      await upload({ id: s.id, file }).unwrap();
      toast.success('Photo updated');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const onDelete = async () => {
    try {
      await del(s.id).unwrap();
      toast.success('Student removed');
      navigate('/students', { replace: true });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const historyCols = [
    { key: 'session', header: 'Session', render: (r) => r.session?.name },
    { key: 'class', header: 'Class', render: (r) => `${r.schoolClass.name}${r.section ? `-${r.section.name}` : ''}` },
    { key: 'medium', header: 'Medium', render: (r) => r.medium.name },
    { key: 'rollNo', header: 'Roll' },
    { key: 'type', header: 'Joined as', render: (r) => <span className="capitalize">{r.enrollmentType}</span> },
    { key: 'status', header: 'Result', render: (r) => <Badge tone={ENR_TONE[r.status]}>{r.status}</Badge> },
  ];

  return (
    <>
      <PageHeader
        title="Student profile"
        actions={
          <>
            <Button icon={ArrowLeft} onClick={() => navigate(-1)}>
              Back
            </Button>
            {canCollect && e && (
              <Button icon={IndianRupee} onClick={() => navigate(`/fees/collect?enrollment=${e.id}`)}>
                Collect fee
              </Button>
            )}
            {canUpdate && (
              <Button icon={UserX} onClick={() => setStatusOpen(true)}>
                Status
              </Button>
            )}
            {canDelete && (
              <Button variant="danger" icon={Trash2} onClick={() => setDeleting(true)}>
                Delete
              </Button>
            )}
            {canUpdate && (
              <Button variant="primary" icon={Pencil} onClick={() => navigate(`/students/${s.id}/edit`)}>
                Edit
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <Avatar name={s.name} photoPath={s.photoPath} size="lg" />
              {canUpdate && (
                <>
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={up.isLoading}
                    className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-full bg-base text-primary shadow-neu-sm active:shadow-neu-in-sm"
                    aria-label="Change photo"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onPhoto} />
                </>
              )}
            </div>
            <h2 className="mt-5 text-lg font-semibold">{s.name}</h2>
            <p className="text-sm text-muted">{s.admissionNo}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Badge tone={st.tone}>{st.label}</Badge>
              {e && (
                <Badge tone="primary">
                  Class {e.schoolClass.name}
                  {e.section ? `-${e.section.name}` : ''}
                </Badge>
              )}
              {e && <Badge>{e.medium.name}</Badge>}
            </div>
            {!e && <p className="mt-4 text-xs text-warning">Not enrolled in the selected session.</p>}
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-4 rounded-2xl p-4 shadow-neu-in-sm">
            <Info label="Roll no." value={e?.rollNo} />
            <Info label="Admission date" value={formatDate(s.admissionDate)} />
            <Info label="Hostel" value={e ? (e.isHostel ? 'Yes' : 'No') : null} />
            <Info label="Transport" value={e ? (e.usesTransport ? 'Yes' : 'No') : null} />
          </dl>
        </Card>

        <div className="space-y-6 xl:col-span-2">
          <Card title="Personal details">
            <dl className="grid gap-4 sm:grid-cols-3">
              <Info label="Gender" value={s.gender && s.gender[0].toUpperCase() + s.gender.slice(1)} />
              <Info label="Date of birth" value={formatDate(s.dob)} />
              <Info label="Blood group" value={s.bloodGroup} />
              <Info label="Category" value={s.category} />
              <Info label="Religion" value={s.religion} />
              <Info label="Aadhar" value={s.aadharNo && `XXXX XXXX ${s.aadharNo.slice(-4)}`} />
              <Info label="APAAR ID" value={s.apaarId} />
              <Info label="PEN" value={s.penNo} />
              <Info label="Biometric ID" value={s.biometricId} />
              <Info label="Previous school" value={s.previousSchool} />
            </dl>
          </Card>
          <Card title="Parents & contact">
            <dl className="grid gap-4 sm:grid-cols-3">
              <Info label="Father" value={s.fatherName} />
              <Info label="Father mobile" value={s.fatherMobile} />
              <Info label="Mother" value={s.motherName} />
              <Info label="Mother mobile" value={s.motherMobile} />
              <Info label="WhatsApp" value={s.whatsappNo} />
              <Info label="Email" value={s.email} />
              <Info label="Address" value={[s.address, s.city, s.pincode].filter(Boolean).join(', ')} />
            </dl>
            {s.status !== 'active' && (
              <p className="mt-4 rounded-xl px-4 py-3 text-sm text-danger shadow-neu-in-sm">
                Left on {formatDate(s.leavingDate)}
                {s.leavingReason ? ` — ${s.leavingReason}` : ''}
                {s.tcNo ? ` · TC ${s.tcNo}` : ''}
              </p>
            )}
          </Card>
          <Card title="Academic history" subtitle="One record per session — promotions never overwrite past years">
            <DataTable columns={historyCols} rows={s.enrollments ?? []} empty="No enrollments" />
          </Card>
          <div className="grid gap-6 lg:grid-cols-2">
            <StudentExtras student={s} />
          </div>
        </div>
      </div>

      {statusOpen && <StatusModal student={s} onClose={() => setStatusOpen(false)} />}
      <ConfirmDialog
        open={deleting}
        title={`Delete ${s.name}?`}
        message="The student is hidden from all lists. Prefer 'Status → Left' for students who left the school."
        loading={d.isLoading}
        onConfirm={onDelete}
        onClose={() => setDeleting(false)}
      />
    </>
  );
}
