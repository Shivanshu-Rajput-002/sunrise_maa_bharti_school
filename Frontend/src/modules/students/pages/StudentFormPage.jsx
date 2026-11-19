import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import Loader from '../../../components/common/Loader';
import PageHeader from '../../../components/common/PageHeader';
import Input from '../../../components/form/Input';
import Select from '../../../components/form/Select';
import Switch from '../../../components/form/Switch';
import { selectScope } from '../../../store/slices/scopeSlice';
import { useClassOptions } from '../../academic/hooks/useClassOptions';
import { useAdmitStudentMutation, useGetStudentQuery, useUpdateStudentMutation } from '../services/studentsApi';
import { useGetRoutesQuery } from '../../../api/opsApi';

const opt = (re, msg) => z.union([z.literal(''), z.string().regex(re, msg)]);
const mobile = opt(/^[6-9]\d{9}$/, 'Enter a valid 10 digit mobile');

const schema = z.object({
  classId: z.coerce.number({ message: 'Select class' }).int().positive('Select class'),
  sectionId: z.string().optional(),
  mediumId: z.coerce.number({ message: 'Select medium' }).int().positive('Select medium'),
  rollNo: z.union([z.literal(''), z.coerce.number().int().positive('Must be positive')]),
  admissionNo: z.string().trim().max(30).optional(),
  admissionDate: z.string().min(1, 'Required'),
  name: z.string().trim().min(2, 'Enter full name').max(120),
  gender: z.enum(['male', 'female', 'other'], { message: 'Select gender' }),
  dob: z.string().optional(),
  bloodGroup: z.string().optional(),
  category: z.string().optional(),
  religion: z.string().trim().max(40).optional(),
  aadharNo: opt(/^\d{12}$/, 'Aadhar must be 12 digits'),
  apaarId: z.string().trim().max(20).optional(),
  penNo: z.string().trim().max(20).optional(),
  fatherName: z.string().trim().max(120).optional(),
  motherName: z.string().trim().max(120).optional(),
  fatherMobile: mobile,
  motherMobile: mobile,
  whatsappNo: mobile,
  email: z.union([z.literal(''), z.string().email('Invalid email')]),
  address: z.string().trim().max(500).optional(),
  city: z.string().trim().max(80).optional(),
  pincode: opt(/^\d{6}$/, '6 digit pincode'),
  previousSchool: z.string().trim().max(150).optional(),
  biometricId: z.string().trim().max(30).optional(),
  transportRouteId: z.string().optional(),
});

const EMPTY = {
  classId: '', sectionId: '', mediumId: '', rollNo: '', admissionNo: '', admissionDate: new Date().toISOString().slice(0, 10),
  name: '', gender: '', dob: '', bloodGroup: '', category: '', religion: '', aadharNo: '', apaarId: '', penNo: '',
  fatherName: '', motherName: '', fatherMobile: '', motherMobile: '', whatsappNo: '', email: '', address: '', city: '', pincode: '', previousSchool: '',
  biometricId: '', transportRouteId: '',
};

const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];
const CATEGORIES = ['GEN', 'OBC', 'SC', 'ST', 'SBC', 'EWS'].map((c) => ({ value: c, label: c }));
const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((c) => ({ value: c, label: c }));

/**
 * New admission: empty optional fields are simply not sent.
 * Edit: an emptied field is sent as null so the stored value is actually cleared.
 */
function toPayload(v, isEdit) {
  const out = {};
  for (const [k, val] of Object.entries(v)) {
    if (k === 'sectionId') out.sectionId = val ? Number(val) : null;
    else if (k === 'transportRouteId') out.transportRouteId = val ? Number(val) : null;
    else if (k === 'rollNo') out.rollNo = val === '' ? null : Number(val);
    else if (val === '' || val === undefined) {
      if (isEdit) out[k] = null;
    } else out[k] = val;
  }
  if (isEdit) delete out.admissionNo;
  return out;
}

export default function StudentFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const scope = useSelector(selectScope);
  const { data: student, isLoading: loadingStudent } = useGetStudentQuery(Number(id), { skip: !isEdit });
  const [admit, a] = useAdmitStudentMutation();
  const [update, u] = useUpdateStudentMutation();
  const [isHostel, setHostel] = useState(false);
  const [usesTransport, setTransport] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { ...EMPTY, mediumId: scope.mediumId ?? '' } });

  const classId = watch('classId');
  const { data: routes = [] } = useGetRoutesQuery();
  const { classOptions, sectionOptions, mediumOptions } = useClassOptions(classId);

  // Load existing student into the form
  useEffect(() => {
    if (!student) return;
    const e = student.currentEnrollment;
    const values = { ...EMPTY };
    for (const k of Object.keys(EMPTY)) if (student[k] != null) values[k] = String(student[k]);
    if (e) {
      values.classId = String(e.classId);
      values.sectionId = e.sectionId ? String(e.sectionId) : '';
      values.mediumId = String(e.mediumId);
      values.rollNo = e.rollNo ? String(e.rollNo) : '';
      values.transportRouteId = e.transportRouteId ? String(e.transportRouteId) : '';
      setHostel(e.isHostel);
      setTransport(e.usesTransport);
    }
    reset(values);
  }, [student, reset]);

  if (isEdit && loadingStudent) return <Loader />;
  const notEnrolled = isEdit && student && !student.currentEnrollment;

  const onSubmit = async (values) => {
    const payload = { ...toPayload(values, isEdit), isHostel, usesTransport };
    if (payload.transportRouteId) payload.usesTransport = true;
    if (notEnrolled) for (const k of ['classId', 'sectionId', 'mediumId', 'rollNo', 'isHostel', 'usesTransport', 'transportRouteId']) delete payload[k];
    try {
      const res = isEdit ? await update({ id: Number(id), ...payload }).unwrap() : await admit(payload).unwrap();
      toast.success(isEdit ? 'Student updated' : `Admission done · ${res.admissionNo}`);
      // New admission: the parent portal login was created / linked — show it once on the profile
      navigate(`/students/${res.id}`, { replace: true, state: !isEdit && res.parentLogin ? { parentLogin: res.parentLogin } : undefined });
    } catch (e) {
      toast.error(e.message);
    }
  };

  const onInvalid = () => toast.error('Please fix the highlighted fields');

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate>
      <PageHeader
        title={isEdit ? `Edit · ${student?.name ?? ''}` : 'New admission'}
        subtitle={isEdit ? student?.admissionNo : 'Student will be enrolled in the session selected at the top.'}
        actions={
          <>
            <Button icon={ArrowLeft} onClick={() => navigate(-1)}>
              Back
            </Button>
            <Button type="submit" variant="primary" icon={Save} loading={a.isLoading || u.isLoading}>
              {isEdit ? 'Save changes' : 'Admit student'}
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Student details">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Input label="Full name" required className="lg:col-span-2" {...register('name')} error={errors.name?.message} />
              <Select label="Gender" required placeholder="Select" options={GENDERS} {...register('gender')} error={errors.gender?.message} />
              <Input label="Date of birth" type="date" {...register('dob')} error={errors.dob?.message} />
              <Select label="Category" placeholder="Select" options={CATEGORIES} {...register('category')} />
              <Input label="Religion" {...register('religion')} />
              <Select label="Blood group" placeholder="Select" options={BLOOD} {...register('bloodGroup')} />
              <Input label="Aadhar no." inputMode="numeric" maxLength={12} {...register('aadharNo')} error={errors.aadharNo?.message} />
              <Input label="APAAR ID" {...register('apaarId')} error={errors.apaarId?.message} />
              <Input label="PEN (UDISE+)" {...register('penNo')} error={errors.penNo?.message} />
              <Input label="Biometric ID" placeholder="Punch ID on the machine" {...register('biometricId')} error={errors.biometricId?.message} />
              <Input label="Previous school" className="lg:col-span-2" {...register('previousSchool')} />
            </div>
          </Card>

          <Card title="Parents & contact">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Father's name" {...register('fatherName')} />
              <Input label="Mother's name" {...register('motherName')} />
              <Input label="Father's mobile" inputMode="numeric" maxLength={10} {...register('fatherMobile')} error={errors.fatherMobile?.message} />
              <Input label="Mother's mobile" inputMode="numeric" maxLength={10} {...register('motherMobile')} error={errors.motherMobile?.message} />
              <Input label="WhatsApp no." inputMode="numeric" maxLength={10} {...register('whatsappNo')} error={errors.whatsappNo?.message} />
              <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
              <Input label="Address" className="sm:col-span-2" {...register('address')} />
              <Input label="City / village" {...register('city')} />
              <Input label="Pincode" inputMode="numeric" maxLength={6} {...register('pincode')} error={errors.pincode?.message} />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Admission" subtitle={notEnrolled ? 'Not enrolled in the selected session — class fields are locked.' : undefined}>
            <fieldset disabled={notEnrolled} className="grid gap-4">
              <Input
                label="Admission no."
                placeholder="Auto-generated if empty"
                disabled={isEdit}
                {...register('admissionNo')}
                error={errors.admissionNo?.message}
              />
              <Input label="Admission date" type="date" required {...register('admissionDate')} error={errors.admissionDate?.message} />
              <Select label="Medium" required placeholder="Select medium" options={mediumOptions} {...register('mediumId')} error={errors.mediumId?.message} />
              <Select
                label="Class"
                required
                placeholder="Select class"
                options={classOptions}
                {...register('classId', { onChange: () => setValue('sectionId', '') })}
                error={errors.classId?.message}
              />
              <Select label="Section" placeholder="No section" options={sectionOptions} disabled={!classId} {...register('sectionId')} />
              <Input label="Roll no." type="number" min={1} placeholder="Assign later" {...register('rollNo')} error={errors.rollNo?.message} />
              <Select
                label="Transport route"
                placeholder="No school transport"
                options={routes.filter((r) => r.isActive).map((r) => ({ value: r.id, label: `${r.name} (₹${Number(r.annualFee)}/yr)` }))}
                {...register('transportRouteId', { onChange: (ev) => setTransport(!!ev.target.value) })}
              />
              <div className="flex flex-col gap-3 pt-1">
                <Switch checked={isHostel} onChange={setHostel} label="Hostel student" />
                <Switch checked={usesTransport} onChange={setTransport} label="Uses school transport" />
              </div>
            </fieldset>
          </Card>
        </div>
      </div>
    </form>
  );
}
