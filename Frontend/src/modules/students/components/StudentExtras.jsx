import { Award, KeyRound, Link2Off, Printer } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useGetCertificatesQuery, useGetParentAccountsQuery, useIssueCertificateMutation, useLinkParentMutation, useUnlinkParentMutation } from '../../../api/opsApi';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import Modal from '../../../components/common/Modal';
import Input from '../../../components/form/Input';
import SegmentedControl from '../../../components/form/SegmentedControl';
import Select from '../../../components/form/Select';
import { useDebounce } from '../../../hooks/useDebounce';
import { usePermission } from '../../../hooks/usePermission';
import { openPdf } from '../../../utils/files';
import { formatDate } from '../../../utils/format';

const TYPES = [
  { value: 'character', label: 'Character certificate' },
  { value: 'study', label: 'Study / bonafide certificate' },
  { value: 'transfer', label: 'Transfer certificate (TC)' },
];
const typeLabel = Object.fromEntries(TYPES.map((t) => [t.value, t.label]));

function IssueModal({ student, onClose }) {
  const [issue, { isLoading }] = useIssueCertificateMutation();
  const [f, setF] = useState({ type: 'character', conduct: 'Good', remarks: '', leavingDate: new Date().toISOString().slice(0, 10), leavingReason: "Parent's request" });
  const submit = async () => {
    try {
      const c = await issue({
        id: student.id,
        type: f.type,
        conduct: f.conduct || undefined,
        remarks: f.remarks || undefined,
        ...(f.type === 'transfer' ? { leavingDate: f.leavingDate, leavingReason: f.leavingReason || undefined } : {}),
      }).unwrap();
      toast.success(`Issued ${c.serialNo}`);
      onClose();
      openPdf(`/students/certificates/${c.id}/pdf`, undefined, `Certificate ${c.serialNo}`);
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <Modal open onClose={onClose} title="Issue certificate" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={isLoading} onClick={submit}>Issue & print</Button></>}>
      <div className="space-y-4">
        <Select label="Certificate" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} options={TYPES} />
        <Input label="Conduct" value={f.conduct} onChange={(e) => setF({ ...f, conduct: e.target.value })} />
        <Input label="Remarks" value={f.remarks} onChange={(e) => setF({ ...f, remarks: e.target.value })} />
        {f.type === 'transfer' && (
          <>
            <Input label="Date of leaving" type="date" value={f.leavingDate} onChange={(e) => setF({ ...f, leavingDate: e.target.value })} />
            <Input label="Reason for leaving" value={f.leavingReason} onChange={(e) => setF({ ...f, leavingReason: e.target.value })} />
            <p className="rounded-xl px-4 py-3 text-xs text-warning shadow-neu-in-sm">Issuing a TC marks the student as “TC issued” and removes them from this session's active lists.</p>
          </>
        )}
      </div>
    </Modal>
  );
}

export function ParentModal({ student, onClose }) {
  const [mode, setMode] = useState('new');
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search);
  const { data: accounts = [] } = useGetParentAccountsQuery({ search: debounced || undefined }, { skip: mode !== 'existing' });
  const [link, { isLoading }] = useLinkParentMutation();
  const [f, setF] = useState({ name: student.fatherName ?? '', username: student.fatherMobile ?? '', password: '', mobile: student.fatherMobile ?? '', userId: '' });
  const submit = async () => {
    try {
      await link(mode === 'existing' ? { id: student.id, userId: Number(f.userId) } : { id: student.id, name: f.name || undefined, username: f.username, password: f.password, mobile: f.mobile || undefined }).unwrap();
      toast.success('Parent login linked');
      onClose();
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <Modal open onClose={onClose} title="Parent portal login" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={isLoading} disabled={mode === 'existing' ? !f.userId : !f.username || f.password.length < 6} onClick={submit}>Save</Button></>}>
      <SegmentedControl value={mode} onChange={setMode} options={[{ value: 'new', label: 'New login' }, { value: 'existing', label: 'Sibling’s login' }]} />
      <div className="mt-4 space-y-4">
        {mode === 'new' ? (
          <>
            <Input label="Parent name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            <Input label="Username" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} hint="Mobile number works well as username" />
            <Input label="Password" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} hint="At least 6 characters — share it with the parent" />
            <Input label="Mobile" inputMode="numeric" maxLength={10} value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} />
          </>
        ) : (
          <>
            <Input label="Search parent account" placeholder="Name, username or mobile" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Select label="Account" value={f.userId} onChange={(e) => setF({ ...f, userId: e.target.value })} placeholder="Select" options={accounts.map((a) => ({ value: a.id, label: `${a.name} (@${a.username}${a.mobile ? `, ${a.mobile}` : ''})` }))} />
          </>
        )}
      </div>
    </Modal>
  );
}

export default function StudentExtras({ student }) {
  const { data: certs = [] } = useGetCertificatesQuery(student.id);
  const [unlink, u] = useUnlinkParentMutation();
  const [issueOpen, setIssueOpen] = useState(false);
  const [parentOpen, setParentOpen] = useState(false);
  const canCert = usePermission('students.certificates');
  const canUpdate = usePermission('students.update');

  return (
    <>
      <Card title="Parent portal" actions={canUpdate && <Button size="sm" icon={KeyRound} onClick={() => setParentOpen(true)}>{student.parentUser ? 'Change' : 'Create login'}</Button>}>
        {student.parentUser ? (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span>
              <span className="font-medium">{student.parentUser.name}</span> <span className="text-muted">@{student.parentUser.username}</span>
            </span>
            {canUpdate && <Button size="sm" variant="ghost" icon={Link2Off} loading={u.isLoading} onClick={async () => { await unlink({ id: student.id }).unwrap(); toast.success('Unlinked'); }}>Unlink</Button>}
          </div>
        ) : (
          <p className="text-sm text-muted">No parent login yet. Parents can see fees, attendance, results and notices once linked.</p>
        )}
      </Card>

      <Card title="Certificates" actions={canCert && <Button size="sm" icon={Award} onClick={() => setIssueOpen(true)}>Issue</Button>}>
        {certs.length ? (
          <ul className="space-y-2">
            {certs.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 rounded-xl px-4 py-2 text-sm shadow-neu-in-sm">
                <span>
                  <span className="font-medium">{typeLabel[c.type]}</span> <Badge className="ml-1">{c.serialNo}</Badge>
                  <span className="block text-xs text-muted">{formatDate(c.issuedOn)} · {c.issuer?.name ?? ''}</span>
                </span>
                {canCert && <Button size="icon-sm" icon={Printer} aria-label="Print" onClick={() => openPdf(`/students/certificates/${c.id}/pdf`, undefined, `Certificate ${c.serialNo}`)} />}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No certificates issued.</p>
        )}
      </Card>

      {issueOpen && <IssueModal student={student} onClose={() => setIssueOpen(false)} />}
      {parentOpen && <ParentModal student={student} onClose={() => setParentOpen(false)} />}
    </>
  );
}
