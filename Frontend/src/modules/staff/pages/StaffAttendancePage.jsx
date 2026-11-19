import clsx from 'clsx';
import { ChevronLeft, ChevronRight, Clock, Fingerprint, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { useGetStaffDayQuery, useGetStaffRegisterQuery, useMarkStaffMutation, useSaveStaffSettingsMutation } from '../../../api/opsApi';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import Loader from '../../../components/common/Loader';
import PageHeader from '../../../components/common/PageHeader';
import StatCard from '../../../components/common/StatCard';
import Tabs from '../../../components/common/Tabs';
import Input from '../../../components/form/Input';
import { usePermission } from '../../../hooks/usePermission';

const STATUSES = [
  { key: 'P', label: 'P', title: 'Present', on: 'bg-success text-white' },
  { key: 'A', label: 'A', title: 'Absent', on: 'bg-danger text-white' },
  { key: 'L', label: 'L', title: 'Leave', on: 'bg-warning text-white' },
  { key: 'HD', label: 'HD', title: 'Half day', on: 'bg-primary text-white' },
];
const CELL = { P: 'bg-success/15 text-success', A: 'bg-danger/15 text-danger', L: 'bg-warning/15 text-warning', HD: 'bg-primary/15 text-primary' };

/** Today in India (YYYY-MM-DD) */
const istToday = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
const hm = (t) => (t ? t.slice(0, 5) : '');

function DayView() {
  const [date, setDate] = useState(istToday());
  const { data, isFetching } = useGetStaffDayQuery({ date });
  const [mark, m] = useMarkStaffMutation();
  const [saveSettings, ss] = useSaveStaffSettingsMutation();
  const [rows, setRows] = useState({});
  const [lateAfter, setLateAfter] = useState('');
  const canMark = usePermission('staff.attendance');
  const canManage = usePermission('staff.manage');

  useEffect(() => {
    if (!data) return;
    setRows(Object.fromEntries(data.rows.map((r) => [r.staffId, { status: r.status, inTime: hm(r.inTime), outTime: hm(r.outTime) }])));
    setLateAfter(data.lateAfter);
  }, [data]);

  const dirty = useMemo(() => (data ? data.rows.filter((r) => {
    const v = rows[r.staffId];
    return v && (v.status !== r.status || v.inTime !== hm(r.inTime) || v.outTime !== hm(r.outTime));
  }) : []), [data, rows]);

  const set = (id, patch) => setRows((x) => ({ ...x, [id]: { ...x[id], ...patch } }));
  const allPresent = () => setRows((x) => Object.fromEntries(Object.entries(x).map(([id, v]) => [id, v.status ? v : { ...v, status: 'P' }])));

  const save = async () => {
    try {
      await mark({ date, records: dirty.map((r) => ({ staffId: r.staffId, status: rows[r.staffId].status, inTime: rows[r.staffId].inTime || null, outTime: rows[r.staffId].outTime || null })) }).unwrap();
      toast.success(`Saved ${dirty.length} staff`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const shift = (n) => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    const next = d.toISOString().slice(0, 10);
    if (next <= istToday()) setDate(next);
  };

  if (!data) return <Loader />;
  const s = data.summary;

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Staff" value={s.total} />
        <StatCard label="Present" value={s.P + s.HD} hint={s.HD ? `${s.HD} half day` : undefined} tone="success" />
        <StatCard label="Absent" value={s.A} tone="danger" />
        <StatCard label="Leave" value={s.L} tone="warning" />
        <StatCard label="Late" value={s.late} hint={`after ${data.lateAfter}`} tone="warning" />
      </div>

      <Card
        title="Daily attendance"
        subtitle={`${s.unmarked} not marked yet · biometric punches fill in automatically`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="icon-sm" icon={ChevronLeft} aria-label="Previous day" onClick={() => shift(-1)} />
            <Input type="date" value={date} max={istToday()} onChange={(e) => e.target.value && setDate(e.target.value)} />
            <Button size="icon-sm" icon={ChevronRight} aria-label="Next day" disabled={date >= istToday()} onClick={() => shift(1)} />
          </div>
        }
      >
        {!data.rows.length ? (
          <p className="py-8 text-center text-sm text-muted">No active staff. <Link to="/staff" className="text-primary">Add staff</Link> first.</p>
        ) : (
          <>
            {canMark && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <Button size="sm" onClick={allPresent}>Mark the rest present</Button>
                <Button variant="primary" icon={Save} loading={m.isLoading} disabled={!dirty.length || isFetching} onClick={save}>Save{dirty.length ? ` (${dirty.length})` : ''}</Button>
              </div>
            )}
            <div className="neu-inset overflow-x-auto p-1">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-muted">
                    <th className="px-3 py-2 text-left">Staff</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">In</th>
                    <th className="px-3 py-2 text-left">Out</th>
                    <th className="px-3 py-2 text-left">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => {
                    const v = rows[r.staffId] ?? {};
                    const late = (v.status === 'P' || v.status === 'HD') && v.inTime && v.inTime > data.lateAfter;
                    const timed = v.status === 'P' || v.status === 'HD';
                    return (
                      <tr key={r.staffId} className="border-t border-line/60">
                        <td className="px-3 py-2">
                          <span className="font-medium">{r.name}</span>
                          <span className="block text-xs text-muted">{r.designation ?? ''}{r.biometricId ? ` · ID ${r.biometricId}` : ''}</span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1" role="radiogroup" aria-label={`Status for ${r.name}`}>
                            {STATUSES.map((st) => (
                              <button
                                key={st.key}
                                type="button"
                                role="radio"
                                aria-checked={v.status === st.key}
                                title={st.title}
                                disabled={!canMark}
                                onClick={() => set(r.staffId, { status: v.status === st.key ? null : st.key })}
                                className={clsx('h-8 min-w-8 rounded-lg px-2 text-xs font-semibold transition', v.status === st.key ? st.on : 'text-muted shadow-neu-sm hover:text-ink')}
                              >
                                {st.label}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <span className="flex items-center gap-2">
                            <input type="time" disabled={!canMark || !timed} value={timed ? v.inTime ?? '' : ''} onChange={(e) => set(r.staffId, { inTime: e.target.value })} className="rounded-lg bg-base px-2 py-1 text-sm shadow-neu-in-sm outline-none disabled:opacity-50" aria-label={`In time for ${r.name}`} />
                            {late && <Badge tone="warning">Late</Badge>}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <input type="time" disabled={!canMark || !timed} value={timed ? v.outTime ?? '' : ''} onChange={(e) => set(r.staffId, { outTime: e.target.value })} className="rounded-lg bg-base px-2 py-1 text-sm shadow-neu-in-sm outline-none disabled:opacity-50" aria-label={`Out time for ${r.name}`} />
                        </td>
                        <td className="px-3 py-2">
                          {r.source === 'biometric' ? <Badge tone="primary"><Fingerprint className="mr-1 h-3 w-3" />Machine</Badge> : r.source === 'manual' ? <Badge>Manual</Badge> : <span className="text-xs text-muted">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {canManage && (
        <Card title="Late rule" className="mt-6">
          <div className="flex flex-wrap items-end gap-3">
            <Input label="Late after" type="time" icon={Clock} value={lateAfter} onChange={(e) => setLateAfter(e.target.value)} hint="Arriving after this time is marked late" />
            <Button loading={ss.isLoading} disabled={!lateAfter || lateAfter === data.lateAfter} onClick={async () => { try { await saveSettings({ lateAfter }).unwrap(); toast.success('Late rule saved'); } catch (e) { toast.error(e.message); } }}>Save</Button>
          </div>
        </Card>
      )}
    </>
  );
}

function RegisterView() {
  const [month, setMonth] = useState(istToday().slice(0, 7));
  const { data, isFetching } = useGetStaffRegisterQuery({ month });
  const shift = (n) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    const next = d.toISOString().slice(0, 7);
    if (next <= istToday().slice(0, 7)) setMonth(next);
  };
  return (
    <Card
      title="Monthly register"
      subtitle="P present · A absent · L leave · HD half day · underlined = late"
      bodyClassName="p-3"
      actions={
        <div className="flex items-center gap-2">
          <Button size="icon-sm" icon={ChevronLeft} aria-label="Previous month" onClick={() => shift(-1)} />
          <Input type="month" value={month} max={istToday().slice(0, 7)} onChange={(e) => e.target.value && setMonth(e.target.value)} />
          <Button size="icon-sm" icon={ChevronRight} aria-label="Next month" disabled={month >= istToday().slice(0, 7)} onClick={() => shift(1)} />
        </div>
      }
    >
      {isFetching && !data ? (
        <Loader />
      ) : !data?.rows.length ? (
        <p className="py-8 text-center text-sm text-muted">No active staff.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted">
                <th className="sticky left-0 z-10 bg-base px-2 py-2 text-left font-medium">Staff</th>
                {Array.from({ length: data.days }, (_, i) => <th key={i} className="w-7 px-0.5 py-2 text-center font-medium tabular-nums">{i + 1}</th>)}
                <th className="px-2 text-center font-medium text-success">P</th>
                <th className="px-2 text-center font-medium text-danger">A</th>
                <th className="px-2 text-center font-medium text-warning">L</th>
                <th className="px-2 text-center font-medium">Late</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.staffId} className="border-t border-line/60">
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-base px-2 py-1.5"><span className="font-medium">{r.name}</span><span className="block text-[10px] text-muted">{r.designation ?? ''}</span></td>
                  {Array.from({ length: data.days }, (_, i) => {
                    const c = r.cells[i + 1];
                    return (
                      <td key={i} className="px-0.5 py-1 text-center">
                        {c ? <span className={clsx('inline-flex h-6 w-6 items-center justify-center rounded text-[10px] font-semibold', CELL[c.status], c.late && 'underline decoration-2')} title={c.late ? 'Late' : undefined}>{c.status}</span> : <span className="text-muted/50">·</span>}
                      </td>
                    );
                  })}
                  <td className="px-2 text-center font-semibold tabular-nums">{r.totals.P + r.totals.HD * 0.5}</td>
                  <td className="px-2 text-center tabular-nums">{r.totals.A}</td>
                  <td className="px-2 text-center tabular-nums">{r.totals.L}</td>
                  <td className="px-2 text-center tabular-nums">{r.totals.late}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default function StaffAttendancePage() {
  const [tab, setTab] = useState('day');
  return (
    <>
      <PageHeader title="Staff attendance" subtitle="Biometric punches show up here automatically; mark the rest by hand." />
      <Tabs tabs={[{ key: 'day', label: 'Daily' }, { key: 'register', label: 'Monthly register' }]} value={tab} onChange={setTab} />
      {tab === 'day' ? <DayView /> : <RegisterView />}
    </>
  );
}
