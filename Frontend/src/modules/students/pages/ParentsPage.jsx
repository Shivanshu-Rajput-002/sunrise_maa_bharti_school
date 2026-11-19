import { KeyRound, Pencil, Search, ShieldCheck, ShieldOff, Unlink, UserPlus, UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import {
  useBulkParentLoginsMutation,
  useGetParentsQuery,
  useGetSettingsQuery,
  useResetParentPasswordMutation,
  useSetParentActiveMutation,
  useUnlinkParentMutation,
  useUpdateParentLoginMutation,
} from '../../../api/opsApi';
import Modal from '../../../components/common/Modal';
import axiosInstance from '../../../utils/axiosInstance';
import Avatar from '../../../components/common/Avatar';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import DataTable from '../../../components/common/DataTable';
import PageHeader from '../../../components/common/PageHeader';
import StatCard from '../../../components/common/StatCard';
import Input from '../../../components/form/Input';
import Select from '../../../components/form/Select';
import { useDebounce } from '../../../hooks/useDebounce';
import { usePermission } from '../../../hooks/usePermission';
import { formatDateTime } from '../../../utils/format';
import { useClassOptions } from '../../academic/hooks/useClassOptions';
import { ParentModal } from '../components/StudentExtras';
import { CredentialsModal } from '../components/ParentCredentials';

/** Admin changes a parent's login: name, username, mobile, and optionally sets a password */
function EditLoginModal({ login, onClose, onSaved }) {
  const [save, s] = useUpdateParentLoginMutation();
  const [f, setF] = useState({ name: login.name ?? '', username: login.username ?? '', mobile: login.mobile ?? '', password: '' });
  const userBad = !/^[a-zA-Z0-9._@-]{3,80}$/.test(f.username);
  const mobileBad = f.mobile !== '' && !/^[6-9]\d{9}$/.test(f.mobile);
  const pwBad = f.password !== '' && f.password.length < 6;
  const submit = async () => {
    try {
      const body = { id: login.id };
      if (f.name.trim() !== (login.name ?? '')) body.name = f.name.trim();
      if (f.username !== login.username) body.username = f.username;
      if (f.mobile !== (login.mobile ?? '')) body.mobile = f.mobile || null;
      if (f.password) body.password = f.password;
      if (Object.keys(body).length === 1) return onClose();
      const res = await save(body).unwrap();
      toast.success('Login updated');
      onSaved(res);
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <Modal open onClose={onClose} title={`Edit parent login · ${login.username}`} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={s.isLoading} disabled={userBad || mobileBad || pwBad || f.name.trim().length < 2} onClick={submit}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Parent name" className="sm:col-span-2" value={f.name} maxLength={120} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Input label="Username (login ID)" value={f.username} maxLength={80} onChange={(e) => setF({ ...f, username: e.target.value.trim() })} error={userBad ? '3-80 letters, numbers, . _ @ -' : undefined} />
        <Input label="Mobile" inputMode="numeric" maxLength={10} value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value.replace(/\D/g, '') })} error={mobileBad ? '10-digit mobile' : undefined} />
        <Input label="New password (optional)" className="sm:col-span-2" value={f.password} maxLength={72} onChange={(e) => setF({ ...f, password: e.target.value })} error={pwBad ? 'At least 6 characters' : undefined} hint="Leave empty to keep the current password. Shown here so you can tell the parent." />
      </div>
    </Modal>
  );
}

export default function ParentsPage() {
  const [f, setF] = useState({ classId: '', sectionId: '', login: 'all', page: 1 });
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search);
  const { classOptions, sectionOptions } = useClassOptions(f.classId);
  const query = { classId: f.classId || undefined, sectionId: f.sectionId || undefined, search: debounced || undefined, login: f.login, page: f.page, limit: 25 };
  const { data, isFetching } = useGetParentsQuery(query);
  const { data: settings } = useGetSettingsQuery();
  const [bulk, b] = useBulkParentLoginsMutation();
  const [reset, rs] = useResetParentPasswordMutation();
  const [setActive] = useSetParentActiveMutation();
  const [unlink, ul] = useUnlinkParentMutation();
  const canEdit = usePermission('students.update');
  const [selected, setSelected] = useState(new Set());
  const [linkFor, setLinkFor] = useState(null);
  const [unlinkFor, setUnlinkFor] = useState(null);
  const [creds, setCreds] = useState(null);
  const [editFor, setEditFor] = useState(null);
  const [busyAll, setBusyAll] = useState(false);
  const schoolName = settings?.school?.name ?? 'School';

  useEffect(() => setSelected(new Set()), [f.classId, f.sectionId, f.login, debounced]);
  const set = (p) => setF((x) => ({ ...x, ...p, page: p.page ?? 1 }));
  const rows = data?.items ?? [];
  const selectable = rows.filter((r) => !r.student.parentUser);
  const allOnPage = selectable.length > 0 && selectable.every((r) => selected.has(r.student.id));

  const runBulk = async (studentIds) => {
    if (!studentIds.length) return toast.error('No students without a login in this list');
    const res = await bulk({ studentIds }).unwrap();
    setSelected(new Set());
    setCreds({
      title: 'Parent logins created',
      summary: `${res.created} new login(s), ${res.linked} linked to a sibling's login, ${res.skipped} skipped.`,
      rows: res.results,
    });
  };

  const createSelected = async () => {
    try {
      await runBulk([...selected]);
    } catch (e) {
      toast.error(e.message);
    }
  };

  /** Every student without a login in the current filter (all pages) */
  const createAll = async () => {
    setBusyAll(true);
    try {
      const ids = [];
      for (let page = 1; page < 100; page++) {
        const res = await axiosInstance.get('/students/parents', { params: { ...query, login: 'without', page, limit: 200 } });
        ids.push(...res.data.items.map((r) => r.student.id));
        if (page >= res.data.meta.totalPages) break;
      }
      for (let i = 0; i < ids.length; i += 500) await runBulk(ids.slice(i, i + 500));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyAll(false);
    }
  };

  const resetPwd = async (r) => {
    try {
      const res = await reset({ id: r.student.parentUser.id }).unwrap();
      setCreds({
        title: `New password · ${res.name}`,
        summary: `Children on this login: ${res.children.map((c) => c.name).join(', ')}`,
        rows: [{ student: res.children.map((c) => c.name).join(', '), admissionNo: res.children.map((c) => c.admissionNo).join(', '), className: r.className, parentName: res.name, username: res.username, password: res.password, status: 'reset' }],
      });
    } catch (e) {
      toast.error(e.message);
    }
  };

  const s = data?.summary;

  return (
    <>
      <PageHeader
        title="Parents"
        subtitle="Parent details and parent-portal logins, filtered by student. Siblings share one login."
        actions={
          canEdit && (
            <>
              <Button icon={UserPlus} disabled={!selected.size} loading={b.isLoading && !busyAll} onClick={createSelected}>
                Create logins{selected.size ? ` (${selected.size})` : ''}
              </Button>
              <Button variant="primary" icon={UsersRound} loading={busyAll} disabled={!s?.withoutLogin} onClick={createAll}>
                Create for all without login{s?.withoutLogin ? ` (${s.withoutLogin})` : ''}
              </Button>
            </>
          )
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Students" value={s?.students ?? '—'} />
        <StatCard label="With parent login" value={s?.withLogin ?? '—'} tone="success" />
        <StatCard label="Without login" value={s?.withoutLogin ?? '—'} tone="warning" />
      </div>

      <Card>
        <div className="mb-5 grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input icon={Search} placeholder="Student, adm. no, father, mother or mobile" value={search} onChange={(e) => { setSearch(e.target.value); set({}); }} />
          <Select value={f.classId} onChange={(e) => set({ classId: e.target.value, sectionId: '' })} placeholder="All classes" options={classOptions} />
          <Select value={f.sectionId} onChange={(e) => set({ sectionId: e.target.value })} placeholder="All sections" options={sectionOptions} disabled={!f.classId} />
          <Select value={f.login} onChange={(e) => set({ login: e.target.value })} options={[{ value: 'all', label: 'All students' }, { value: 'with', label: 'With parent login' }, { value: 'without', label: 'Without parent login' }]} />
        </div>

        <DataTable
          loading={isFetching && !data}
          rows={rows}
          rowKey="enrollmentId"
          meta={data?.meta}
          onPageChange={(page) => set({ page })}
          empty="No students match these filters"
          columns={[
            ...(canEdit
              ? [{
                  key: 'sel',
                  header: <input type="checkbox" aria-label="Select all on this page" className="h-4 w-4 accent-[rgb(var(--primary))]" checked={allOnPage} disabled={!selectable.length} onChange={(e) => setSelected((old) => { const n = new Set(old); selectable.forEach((r) => (e.target.checked ? n.add(r.student.id) : n.delete(r.student.id))); return n; })} />,
                  className: 'w-8',
                  render: (r) => !r.student.parentUser && <input type="checkbox" aria-label={`Select ${r.student.name}`} className="h-4 w-4 accent-[rgb(var(--primary))]" checked={selected.has(r.student.id)} onChange={(e) => setSelected((old) => { const n = new Set(old); e.target.checked ? n.add(r.student.id) : n.delete(r.student.id); return n; })} />,
                }]
              : []),
            {
              key: 'student',
              header: 'Student',
              render: (r) => (
                <Link to={`/students/${r.student.id}`} className="flex items-center gap-3 hover:text-primary">
                  <Avatar name={r.student.name} photoPath={r.student.photoPath} />
                  <span><span className="block font-medium">{r.student.name}</span><span className="block text-xs text-muted">{r.student.admissionNo} · {r.className} · {r.medium}</span></span>
                </Link>
              ),
            },
            {
              key: 'parents',
              header: 'Parents',
              render: (r) => (
                <span className="text-sm">
                  <span className="block">{r.student.fatherName || '—'} <span className="text-xs text-muted">(F)</span>{r.student.fatherMobile && <a href={`tel:${r.student.fatherMobile}`} className="ml-1 text-xs text-primary">{r.student.fatherMobile}</a>}</span>
                  <span className="block">{r.student.motherName || '—'} <span className="text-xs text-muted">(M)</span>{r.student.motherMobile && <a href={`tel:${r.student.motherMobile}`} className="ml-1 text-xs text-primary">{r.student.motherMobile}</a>}</span>
                  {r.student.address && <span className="block max-w-[220px] truncate text-xs text-muted">{r.student.address}{r.student.city ? `, ${r.student.city}` : ''}</span>}
                </span>
              ),
            },
            {
              key: 'login',
              header: 'Portal login',
              render: (r) => {
                const u = r.student.parentUser;
                if (!u) return <Badge tone="warning">No login</Badge>;
                return (
                  <span className="text-sm">
                    <span className="flex items-center gap-2"><span className="font-mono font-medium">{u.username}</span>{u.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="danger">Disabled</Badge>}</span>
                    <span className="block text-xs text-muted">{u.name}{r.children > 1 ? ` · ${r.children} children` : ''}</span>
                    <span className="block text-xs text-muted">{u.lastLoginAt ? `Last login ${formatDateTime(u.lastLoginAt)}` : 'Never logged in'}</span>
                  </span>
                );
              },
            },
            {
              key: 'a',
              header: '',
              className: 'text-right',
              render: (r) =>
                canEdit && (
                  <div className="flex justify-end gap-1.5">
                    {r.student.parentUser ? (
                      <>
                        <Button size="icon-sm" icon={Pencil} title="Edit login (username / password)" aria-label={`Edit login ${r.student.parentUser.username}`} onClick={() => setEditFor({ ...r.student.parentUser, className: r.className, student: r.student })} />
                        <Button size="icon-sm" icon={KeyRound} title="Reset password" aria-label={`Reset password for ${r.student.parentUser.username}`} loading={rs.isLoading && rs.originalArgs?.id === r.student.parentUser.id} onClick={() => resetPwd(r)} />
                        <Button size="icon-sm" icon={r.student.parentUser.isActive ? ShieldOff : ShieldCheck} title={r.student.parentUser.isActive ? 'Disable login' : 'Enable login'} aria-label="Enable or disable login" onClick={async () => { try { await setActive({ id: r.student.parentUser.id, isActive: !r.student.parentUser.isActive }).unwrap(); toast.success(r.student.parentUser.isActive ? 'Login disabled' : 'Login enabled'); } catch (e) { toast.error(e.message); } }} />
                        <Button size="icon-sm" variant="danger" icon={Unlink} title="Remove login from this student" aria-label="Unlink parent login" onClick={() => setUnlinkFor(r)} />
                      </>
                    ) : (
                      <Button size="sm" icon={UserPlus} onClick={() => setLinkFor(r.student)}>Create / link</Button>
                    )}
                  </div>
                ),
            },
          ]}
        />
      </Card>

      {linkFor && <ParentModal student={linkFor} onClose={() => setLinkFor(null)} />}
      {editFor && (
        <EditLoginModal
          login={editFor}
          onClose={() => setEditFor(null)}
          onSaved={(res) => {
            const st = editFor.student;
            setEditFor(null);
            if (res.password) setCreds({ title: `Login updated · ${res.name}`, rows: [{ student: st.name, admissionNo: st.admissionNo, className: editFor.className, parentName: res.name, username: res.username, password: res.password, status: 'updated' }] });
          }}
        />
      )}
      {creds && <CredentialsModal result={creds} schoolName={schoolName} onClose={() => setCreds(null)} />}
      <ConfirmDialog
        open={!!unlinkFor}
        title={`Remove portal login from ${unlinkFor?.student.name}?`}
        message="The parent login itself stays (siblings keep using it); only this student is detached."
        loading={ul.isLoading}
        onConfirm={async () => { try { await unlink({ id: unlinkFor.student.id }).unwrap(); toast.success('Login removed from student'); setUnlinkFor(null); } catch (e) { toast.error(e.message); } }}
        onClose={() => setUnlinkFor(null)}
      />
    </>
  );
}
