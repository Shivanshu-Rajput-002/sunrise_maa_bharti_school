import { FileCheck2, Printer, ScrollText } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useSelector } from 'react-redux';
import { useGetCertificateRegisterQuery, useIssueCertificateMutation } from '../../../api/opsApi';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import DataTable from '../../../components/common/DataTable';
import Modal from '../../../components/common/Modal';
import PageHeader from '../../../components/common/PageHeader';
import Tabs from '../../../components/common/Tabs';
import Input from '../../../components/form/Input';
import Select from '../../../components/form/Select';
import { selectScope } from '../../../store/slices/scopeSlice';
import { openPdf } from '../../../utils/files';
import { formatDate } from '../../../utils/format';
import { useClassOptions } from '../../academic/hooks/useClassOptions';

const TYPES = [
  { key: 'character', label: 'Character Certificates' },
  { key: 'study', label: 'Study Certificates' },
  { key: 'transfer', label: 'Transfer Certificates (TC)' },
];
const SHORT = { character: 'Character certificate', study: 'Study certificate', transfer: 'TC' };

/** TC changes the student's status to "TC issued", so it always asks for the leaving details first */
function TcModal({ row, onClose, onIssue, loading }) {
  const [f, setF] = useState({ leavingDate: new Date().toISOString().slice(0, 10), leavingReason: "Parent's request", conduct: 'Good' });
  return (
    <Modal open onClose={onClose} title={`Issue TC · ${row.name}`} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="danger" loading={loading} onClick={() => onIssue(f)}>Issue TC & print</Button></>}>
      <p className="mb-4 text-sm text-warning">After the TC is issued the student is marked as left for this session.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Leaving date" type="date" value={f.leavingDate} onChange={(e) => setF({ ...f, leavingDate: e.target.value })} />
        <Input label="Conduct" value={f.conduct} maxLength={60} onChange={(e) => setF({ ...f, conduct: e.target.value })} />
        <Input label="Reason for leaving" className="sm:col-span-2" maxLength={255} value={f.leavingReason} onChange={(e) => setF({ ...f, leavingReason: e.target.value })} />
      </div>
    </Modal>
  );
}

/** Class-wise list like the old site: pick a class, then View / Issue per student */
export default function CertificatesPage() {
  const scope = useSelector(selectScope);
  const [type, setType] = useState('character');
  const [f, setF] = useState({ classId: '', sectionId: '', mediumId: scope.mediumId ? String(scope.mediumId) : '' });
  const { classOptions, sectionOptions, mediumOptions } = useClassOptions(f.classId);
  const { data: rows = [], isFetching } = useGetCertificateRegisterQuery(
    { type, classId: f.classId, sectionId: f.sectionId || undefined, mediumId: f.mediumId || undefined },
    { skip: !f.classId },
  );
  const [issue, iss] = useIssueCertificateMutation();
  const [busyId, setBusyId] = useState(null);
  const [tcFor, setTcFor] = useState(null);

  const view = (c, name) => openPdf(`/students/certificates/${c.id}/pdf`, undefined, `${SHORT[type]} · ${name}`);

  const doIssue = async (r, extra = {}) => {
    setBusyId(r.studentId);
    try {
      const c = await issue({ id: r.studentId, type, ...extra }).unwrap();
      toast.success(`Issued ${c.serialNo}`);
      setTcFor(null);
      view(c, r.name);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const issued = rows.filter((r) => r.certificate).length;

  return (
    <>
      <PageHeader title="Certificates" subtitle="Character, study and transfer certificates in the school's print format." />
      <Tabs tabs={TYPES} value={type} onChange={setType} />
      <Card className="mb-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Select label="Class" value={f.classId} onChange={(e) => setF({ ...f, classId: e.target.value, sectionId: '' })} placeholder="Select class" options={classOptions} />
          <Select label="Medium" value={f.mediumId} onChange={(e) => setF({ ...f, mediumId: e.target.value })} placeholder="All mediums" options={mediumOptions} />
          <Select label="Section" value={f.sectionId} onChange={(e) => setF({ ...f, sectionId: e.target.value })} placeholder="All sections" options={sectionOptions} disabled={!f.classId} />
        </div>
      </Card>

      {!f.classId ? (
        <Card>
          <div className="flex flex-col items-center gap-2 py-10 text-center text-muted">
            <ScrollText className="h-8 w-8" />
            <p className="text-sm">Select a class to see its students.</p>
          </div>
        </Card>
      ) : (
        <Card title={TYPES.find((t) => t.key === type).label} subtitle={`${rows.length} students · ${issued} issued this session`}>
          <DataTable
            loading={isFetching}
            rows={rows}
            rowKey="enrollmentId"
            empty="No students in this class"
            columns={[
              { key: 'roll', header: 'Roll', render: (r) => r.rollNo ?? '—' },
              { key: 'name', header: 'Student', render: (r) => <span><span className="font-medium">{r.name}</span><span className="block text-xs text-muted">{r.admissionNo} · {r.fatherName ?? ''}</span></span> },
              { key: 'cls', header: 'Class', render: (r) => `${r.className} · ${r.medium ?? ''}` },
              { key: 'cert', header: 'Certificate', render: (r) => (r.certificate ? <span><Badge tone="success">{r.certificate.serialNo}</Badge><span className="ml-2 text-xs text-muted">{formatDate(r.certificate.issuedOn)}</span></span> : <span className="text-xs text-muted">Not issued</span>) },
              {
                key: 'a',
                header: '',
                className: 'text-right',
                render: (r) =>
                  r.certificate ? (
                    <Button size="sm" icon={Printer} onClick={() => view(r.certificate, r.name)}>View / Print</Button>
                  ) : type === 'transfer' && r.studentStatus === 'tc_issued' ? (
                    <Badge tone="neutral">TC issued earlier</Badge>
                  ) : (
                    <Button size="sm" variant="primary" icon={FileCheck2} loading={busyId === r.studentId} onClick={() => (type === 'transfer' ? setTcFor(r) : doIssue(r))}>Issue & print</Button>
                  ),
              },
            ]}
          />
        </Card>
      )}
      {tcFor && <TcModal row={tcFor} loading={iss.isLoading} onClose={() => setTcFor(null)} onIssue={(x) => doIssue(tcFor, x)} />}
    </>
  );
}
