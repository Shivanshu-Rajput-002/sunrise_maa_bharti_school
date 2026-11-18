import { ImageUp, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useGetSettingsQuery, useSaveFeeSettingsMutation, useSaveGradesMutation, useSavePrintSettingsMutation, useSaveSchoolMutation } from '../../../api/opsApi';
import { baseApi } from '../../../app/store/baseApi';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import Loader from '../../../components/common/Loader';
import PageHeader from '../../../components/common/PageHeader';
import Input from '../../../components/form/Input';
import { usePermission } from '../../../hooks/usePermission';
import { uploadFile } from '../../../utils/files';
import { useDispatch } from 'react-redux';

export default function SettingsPage() {
  const dispatch = useDispatch();
  const { data, isLoading } = useGetSettingsQuery();
  const [saveSchool, s1] = useSaveSchoolMutation();
  const [saveFees, s2] = useSaveFeeSettingsMutation();
  const [saveGrades, s3] = useSaveGradesMutation();
  const [savePrint, s4] = useSavePrintSettingsMutation();
  const [print, setPrint] = useState(null);
  const canEdit = usePermission('settings.update');
  const [school, setSchool] = useState(null);
  const [fees, setFees] = useState(null);
  const [grades, setGrades] = useState([]);
  const [uploading, setUploading] = useState(false);
  const logoRef = useRef(null);

  useEffect(() => {
    if (!data) return;
    setSchool(data.school);
    setFees(data.fees);
    setGrades(data.grades);
    setPrint(data.print);
  }, [data]);

  if (isLoading || !school || !print) return <Loader />;

  const run = async (fn, msg) => {
    try {
      await fn();
      toast.success(msg);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const onLogo = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setUploading(true);
    await run(() => uploadFile('/admin/settings/logo', f, 'logo'), 'Logo updated');
    dispatch(baseApi.util.invalidateTags(['Settings']));
    setUploading(false);
  };

  const field = (k, label, props = {}) => (
    <Input label={label} value={school[k] ?? ''} disabled={!canEdit} onChange={(e) => setSchool({ ...school, [k]: e.target.value })} {...props} />
  );

  return (
    <>
      <PageHeader title="Settings" subtitle="School details printed on receipts, certificates, ID cards and report cards." />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card
          title="School profile"
          className="xl:col-span-2"
          actions={
            canEdit && (
              <Button variant="primary" size="sm" icon={Save} loading={s1.isLoading} onClick={() => run(() => saveSchool({ name: school.name, tagline: school.tagline, address: school.address, phone: school.phone, email: school.email, affiliation: school.affiliation, principal: school.principal }).unwrap(), 'School profile saved')}>
                Save
              </Button>
            )
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {field('name', 'School name', { className: 'sm:col-span-2' })}
            {field('tagline', 'Tagline (e.g. English & Hindi Medium)', { className: 'sm:col-span-2' })}
            {field('address', 'Address', { className: 'sm:col-span-2' })}
            {field('phone', 'Phone')}
            {field('email', 'Email', { type: 'email' })}
            {field('affiliation', 'Affiliation / board')}
            {field('principal', "Principal's name")}
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="Logo">
            <div className="flex items-center gap-4">
              <div className="neu-inset flex h-20 w-20 items-center justify-center overflow-hidden">
                {school.logoPath ? <img src={`/uploads/${school.logoPath}`} alt="School logo" className="h-full w-full object-contain" /> : <span className="text-xs text-muted">No logo</span>}
              </div>
              {canEdit && (
                <>
                  <Button icon={ImageUp} loading={uploading} onClick={() => logoRef.current?.click()}>
                    Upload
                  </Button>
                  <input ref={logoRef} type="file" accept="image/png,image/jpeg" hidden onChange={onLogo} />
                </>
              )}
            </div>
            <p className="mt-3 text-xs text-muted">PNG or JPG, square, under 1 MB.</p>
          </Card>

          <Card
            title="Fee rules"
            actions={
              canEdit && (
                <Button variant="primary" size="sm" icon={Save} loading={s2.isLoading} onClick={() => run(() => saveFees({ fullPaymentDiscountPercent: Number(fees.fullPaymentDiscountPercent), lateFeePerInstallment: Number(fees.lateFeePerInstallment), receiptPrefix: fees.receiptPrefix }).unwrap(), 'Fee rules saved')}>
                  Save
                </Button>
              )
            }
          >
            <div className="space-y-4">
              <Input label="Full-payment discount (%)" type="number" min={0} max={100} value={fees.fullPaymentDiscountPercent} disabled={!canEdit} onChange={(e) => setFees({ ...fees, fullPaymentDiscountPercent: e.target.value })} hint="Allowed when all remaining dues are paid in one receipt. 0 = off." />
              <Input label="Late fee per overdue installment (₹)" type="number" min={0} value={fees.lateFeePerInstallment} disabled={!canEdit} onChange={(e) => setFees({ ...fees, lateFeePerInstallment: e.target.value })} hint="Suggested at collection time. 0 = off." />
              <Input label="Receipt prefix" value={fees.receiptPrefix} maxLength={8} disabled={!canEdit} onChange={(e) => setFees({ ...fees, receiptPrefix: e.target.value.toUpperCase() })} hint="e.g. R → R26-00001" />
            </div>
          </Card>
        </div>

        <Card
          title="Print formats"
          subtitle="Text on the receipt, admit card, marksheet and certificates (same layout as the old site)"
          className="xl:col-span-3"
          actions={
            canEdit && (
              <Button variant="primary" size="sm" icon={Save} loading={s4.isLoading} onClick={() => run(() => savePrint(print).unwrap(), 'Print formats saved')}>
                Save
              </Button>
            )
          }
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['schoolName', 'School name (marksheet)'],
              ['schoolNameHi', 'School name in Hindi (certificates)'],
              ['certName', 'School name (English certificates)'],
              ['shortName', 'School name (receipt)'],
              ['admitName', 'School name (admit card)'],
              ['department', 'Department line (marksheet)'],
              ['address', 'Address (receipt, certificates)'],
              ['addressHi', 'Address in Hindi'],
              ['phone', 'Mobile'],
              ['campusHi', 'Campus line · Hindi medium'],
              ['campusEn', 'Campus line · English medium'],
              ['udiseCode', 'UDISE code'],
              ['pspCode', 'PSP code'],
              ['dicCode', 'DIC code'],
              ['boardCode', 'Board code'],
            ].map(([k, label]) => (
              <Input key={k} label={label} value={print[k] ?? ''} disabled={!canEdit} maxLength={200} onChange={(e) => setPrint({ ...print, [k]: e.target.value })} />
            ))}
          </div>
        </Card>

        <Card
          title="Grading scale"
          subtitle="Minimum percentage for each grade"
          className="xl:col-span-3"
          actions={
            canEdit && (
              <>
                <Button size="sm" icon={Plus} onClick={() => setGrades([...grades, { min: 0, grade: '' }])}>
                  Add
                </Button>
                <Button variant="primary" size="sm" icon={Save} loading={s3.isLoading} onClick={() => run(() => saveGrades({ grades: grades.map((g) => ({ min: Number(g.min), grade: g.grade.trim() })) }).unwrap(), 'Grades saved')}>
                  Save
                </Button>
              </>
            )
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {grades.map((g, i) => (
              <div key={i} className="flex items-end gap-2 rounded-2xl p-3 shadow-neu-in-sm">
                <Input label="Grade" value={g.grade} disabled={!canEdit} onChange={(e) => setGrades(grades.map((x, j) => (j === i ? { ...x, grade: e.target.value } : x)))} />
                <Input label="Min %" type="number" min={0} max={100} value={g.min} disabled={!canEdit} onChange={(e) => setGrades(grades.map((x, j) => (j === i ? { ...x, min: e.target.value } : x)))} />
                {canEdit && <Button size="icon" variant="danger" icon={Trash2} aria-label="Remove" onClick={() => setGrades(grades.filter((_, j) => j !== i))} />}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
