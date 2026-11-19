import clsx from 'clsx';
import { BadgePercent, IndianRupee, Printer, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { useCollectFeeMutation, useGetDuesQuery, useGetLedgerQuery, useRemoveConcessionMutation, useSetConcessionMutation } from '../../../api/opsApi';
import Avatar from '../../../components/common/Avatar';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import DataTable from '../../../components/common/DataTable';
import Loader from '../../../components/common/Loader';
import Modal from '../../../components/common/Modal';
import PageHeader from '../../../components/common/PageHeader';
import Input from '../../../components/form/Input';
import Select from '../../../components/form/Select';
import Switch from '../../../components/form/Switch';
import { useDebounce } from '../../../hooks/useDebounce';
import { usePermission } from '../../../hooks/usePermission';
import { openPdf } from '../../../utils/files';
import { formatDate, formatMoney } from '../../../utils/format';
import { useClassOptions } from '../../academic/hooks/useClassOptions';
import { useGetStudentsQuery } from '../../students/services/studentsApi';

const MODES = ['cash', 'upi', 'online', 'cheque', 'bank'].map((m) => ({ value: m, label: m.toUpperCase() }));
const lineKey = (l) => `${l.installmentId}:${l.feeHeadId ?? 'T'}`;
const round2 = (n) => Math.round(n * 100) / 100;

function StudentPicker({ onPick }) {
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 300);
  const { data, isFetching } = useGetStudentsQuery({ search: debounced, limit: 8, enrollmentStatus: 'studying' }, { skip: debounced.trim().length < 2 });
  return (
    <div className="relative">
      <Input icon={Search} autoFocus placeholder="Search student by name, admission no. or mobile…" value={search} onChange={(e) => setSearch(e.target.value)} />
      {debounced.trim().length >= 2 && (
        <div className="neu-card absolute z-20 mt-2 w-full p-2 animate-fade-in">
          {isFetching && <p className="px-3 py-2 text-sm text-muted">Searching…</p>}
          {!isFetching && !data?.items?.length && <p className="px-3 py-2 text-sm text-muted">No students found in this session</p>}
          {data?.items?.map((e) => (
            <button key={e.id} onClick={() => { onPick(e.id); setSearch(''); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:shadow-neu-in-sm">
              <Avatar name={e.student.name} photoPath={e.student.photoPath} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{e.student.name}</span>
                <span className="block text-xs text-muted">{e.student.admissionNo} · {e.schoolClass.name}{e.section ? `-${e.section.name}` : ''} · {e.medium.name} · {e.student.fatherName ?? ''}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Shown until a student is picked: class-wise list with dues, click to collect */
function StudentDuesList({ filters, onPick }) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [filters.classId, filters.sectionId, filters.onlyDue]);
  const { data, isFetching } = useGetDuesQuery({
    classId: filters.classId || undefined,
    sectionId: filters.sectionId || undefined,
    onlyDue: filters.onlyDue,
    page,
    limit: 20,
  });
  const s = data?.summary;
  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Students', data?.meta.total ?? '—', ''],
          ['Due till today', s ? formatMoney(s.dueTillDate) : '—', 'text-danger'],
          ['With overdue fees', s?.defaulters ?? '—', 'text-warning'],
          ['Collected so far', s ? formatMoney(s.paid) : '—', 'text-success'],
        ].map(([k, v, tone]) => (
          <div key={k} className="neu-card px-4 py-3">
            <p className="text-xs text-muted">{k}</p>
            <p className={clsx('text-lg font-semibold tabular-nums', tone)}>{v}</p>
          </div>
        ))}
      </div>
      <Card title={filters.onlyDue ? 'Students with pending fees' : 'All students'} subtitle="Click a student to collect fees">
        <DataTable
          loading={isFetching && !data}
          rows={data?.items ?? []}
          rowKey="enrollmentId"
          meta={data?.meta}
          onPageChange={setPage}
          empty={filters.onlyDue ? 'No pending fees in this selection' : 'No students found'}
          columns={[
            {
              key: 'student',
              header: 'Student',
              render: (r) => (
                <button type="button" onClick={() => onPick(r.enrollmentId)} className="flex items-center gap-3 text-left hover:text-primary">
                  <Avatar name={r.student.name} photoPath={r.student.photoPath} />
                  <span><span className="block font-medium">{r.student.name}</span><span className="block text-xs text-muted">{r.student.admissionNo} · {r.student.fatherName ?? ''}</span></span>
                </button>
              ),
            },
            { key: 'class', header: 'Class', render: (r) => `${r.schoolClass.name}${r.section ? `-${r.section.name}` : ''} · ${r.medium?.name ?? ''}` },
            { key: 'paid', header: 'Paid', className: 'text-right tabular-nums', render: (r) => formatMoney(r.totals.paid) },
            { key: 'now', header: 'Due till today', className: 'text-right tabular-nums', render: (r) => <span className={r.totals.dueTillDate > 0 ? 'font-semibold text-danger' : ''}>{formatMoney(r.totals.dueTillDate)}</span> },
            { key: 'due', header: 'Full year', className: 'text-right tabular-nums', render: (r) => formatMoney(r.totals.due) },
            { key: 'od', header: '', render: (r) => r.overdueInstallments > 0 && <Badge tone="danger">{r.overdueInstallments} overdue</Badge> },
            { key: 'a', header: '', className: 'text-right', render: (r) => (r.totals.due > 0 ? <Button size="sm" icon={IndianRupee} onClick={() => onPick(r.enrollmentId)}>Collect</Button> : <Badge tone="success">Paid</Badge>) },
          ]}
        />
      </Card>
    </>
  );
}

function ConcessionModal({ enrollmentId, current, onClose }) {
  const [save, s] = useSetConcessionMutation();
  const [remove, r] = useRemoveConcessionMutation();
  const [f, setF] = useState({ type: current?.type ?? 'percent', value: current?.value ?? '', reason: current?.reason ?? '' });
  const submit = async () => {
    try {
      await save({ id: enrollmentId, type: f.type, value: Number(f.value), reason: f.reason || undefined }).unwrap();
      toast.success('Concession saved');
      onClose();
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <Modal open onClose={onClose} title="Fee concession" size="sm" footer={<>
      {current && <Button variant="danger" loading={r.isLoading} onClick={async () => { await remove({ id: enrollmentId }).unwrap(); toast.success('Concession removed'); onClose(); }}>Remove</Button>}
      <Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={s.isLoading} onClick={submit}>Save</Button></>}>
      <div className="space-y-4">
        <Select label="Type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} options={[{ value: 'percent', label: 'Percent of total fee' }, { value: 'fixed', label: 'Fixed amount for the year' }]} />
        <Input label={f.type === 'percent' ? 'Percent' : 'Amount (₹)'} type="number" min={0} value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} />
        <Input label="Reason" placeholder="e.g. Sibling, Staff ward, Scholarship" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
      </div>
    </Modal>
  );
}

export default function CollectFeePage() {
  const [params, setParams] = useSearchParams();
  const enrollmentId = Number(params.get('enrollment')) || null;
  const { data: ledger, isFetching, isError, error } = useGetLedgerQuery(enrollmentId, { skip: !enrollmentId });
  const [collect, c] = useCollectFeeMutation();
  const canManage = usePermission('fees.manage');

  const [picked, setPicked] = useState({}); // lineKey → amount string
  const [form, setForm] = useState({ paymentDate: new Date().toISOString().slice(0, 10), mode: 'cash', reference: '', remarks: '', discount: '', fine: '' });
  const [concOpen, setConcOpen] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [filters, setFilters] = useState({ classId: '', sectionId: '', onlyDue: true });
  const { classOptions, sectionOptions } = useClassOptions(filters.classId);
  const pick = (id) => {
    setParams({ enrollment: String(id) });
    setLastReceipt(null);
  };

  useEffect(() => {
    setPicked({});
    setForm((f) => ({ ...f, discount: '', fine: '' }));
  }, [enrollmentId]);

  const lines = useMemo(() => (ledger?.installments ?? []).flatMap((i) => i.lines), [ledger]);
  const gross = round2(Object.values(picked).reduce((n, v) => n + Number(v || 0), 0));
  const clearsAll = ledger && gross > 0 && round2(gross) === round2(ledger.totals.due);
  const net = round2(gross - Number(form.discount || 0) + Number(form.fine || 0));

  // Suggest the full-payment discount automatically when everything is selected
  useEffect(() => {
    if (!ledger) return;
    setForm((f) => ({ ...f, discount: clearsAll && ledger.fullPaymentDiscount > 0 ? String(ledger.fullPaymentDiscount) : canManage ? f.discount : '' }));
  }, [clearsAll]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleLine = (l) => setPicked((p) => {
    const n = { ...p };
    if (n[lineKey(l)] !== undefined) delete n[lineKey(l)];
    else n[lineKey(l)] = String(l.due);
    return n;
  });
  const selectInstallment = (inst) => setPicked((p) => {
    const n = { ...p };
    const all = inst.lines.filter((l) => l.due > 0).every((l) => n[lineKey(l)] !== undefined);
    inst.lines.filter((l) => l.due > 0).forEach((l) => (all ? delete n[lineKey(l)] : (n[lineKey(l)] = String(l.due))));
    return n;
  });
  const selectAllDue = () => setPicked(Object.fromEntries(lines.filter((l) => l.due > 0).map((l) => [lineKey(l), String(l.due)])));
  const selectTillToday = () => {
    const today = new Date().toISOString().slice(0, 10);
    setPicked(Object.fromEntries((ledger?.installments ?? []).filter((i) => i.dueDate <= today).flatMap((i) => i.lines).filter((l) => l.due > 0).map((l) => [lineKey(l), String(l.due)])));
  };

  const submit = async () => {
    const items = lines.filter((l) => picked[lineKey(l)] !== undefined && Number(picked[lineKey(l)]) > 0).map((l) => ({ installmentId: l.installmentId, feeHeadId: l.feeHeadId, amount: Number(picked[lineKey(l)]) }));
    if (!items.length) return toast.error('Select at least one fee line');
    const over = lines.find((l) => Number(picked[lineKey(l)] || 0) > l.due);
    if (over) return toast.error(`${over.head}: amount is more than the due`);
    try {
      const res = await collect({
        enrollmentId,
        paymentDate: form.paymentDate,
        mode: form.mode,
        reference: form.reference || undefined,
        remarks: form.remarks || undefined,
        discount: Number(form.discount || 0),
        fine: Number(form.fine || 0),
        items,
      }).unwrap();
      toast.success(`Collected ${formatMoney(Number(res.netAmount))} · Receipt ${res.receiptNo}`);
      setLastReceipt(res);
      setPicked({});
      openPdf(`/fees/payments/${res.id}/receipt.pdf`, undefined, 'Fee receipt');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const e = ledger?.enrollment;

  return (
    <>
      <PageHeader title="Collect fees" subtitle="Pick a student, tick the fee lines being paid, and print the receipt." />
      <Card className="mb-6 overflow-visible">
        <StudentPicker onPick={pick} />
        {!enrollmentId && (
          <div className="mt-4 grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Select label="Class" value={filters.classId} onChange={(ev) => setFilters({ ...filters, classId: ev.target.value, sectionId: '' })} placeholder="All classes" options={classOptions} />
            <Select label="Section" value={filters.sectionId} onChange={(ev) => setFilters({ ...filters, sectionId: ev.target.value })} placeholder="All sections" options={sectionOptions} disabled={!filters.classId} />
            <div className="pb-2"><Switch checked={filters.onlyDue} onChange={(v) => setFilters({ ...filters, onlyDue: v })} label="Only students with pending fees" /></div>
          </div>
        )}
      </Card>

      {!enrollmentId && <StudentDuesList filters={filters} onPick={pick} />}

      {lastReceipt && (
        <Card className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              Last receipt <span className="font-semibold">{lastReceipt.receiptNo}</span> · {formatMoney(Number(lastReceipt.netAmount))}
            </p>
            <Button icon={Printer} onClick={() => openPdf(`/fees/payments/${lastReceipt.id}/receipt.pdf`, undefined, 'Fee receipt')}>Print again</Button>
          </div>
        </Card>
      )}

      {enrollmentId && isFetching && !ledger && <Loader />}
      {isError && <Card><p className="text-sm text-danger">{error?.message}</p></Card>}

      {ledger && e && (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <Card>
              <div className="flex flex-wrap items-center gap-4">
                <Avatar name={e.student.name} photoPath={e.student.photoPath} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold">{e.student.name}</p>
                  <p className="text-sm text-muted">
                    {e.student.admissionNo} · Class {e.schoolClass.name}{e.section ? `-${e.section.name}` : ''} · {e.medium.name} · {e.student.fatherName}
                  </p>
                </div>
                <Button size="icon-sm" variant="ghost" icon={X} aria-label="Clear student" onClick={() => setParams({})} />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ['Total fee', ledger.totals.payable],
                  ['Paid', ledger.totals.paid],
                  ['Due till today', ledger.totals.dueTillDate],
                  ['Due (full year)', ledger.totals.due],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl px-4 py-3 shadow-neu-in-sm">
                    <p className="text-xs text-muted">{k}</p>
                    <p className={clsx('font-semibold tabular-nums', k.startsWith('Due') && v > 0 && 'text-danger')}>{formatMoney(v)}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                {ledger.concession ? (
                  <Badge tone="success">
                    Concession: {ledger.concession.type === 'percent' ? `${ledger.concession.value}%` : formatMoney(ledger.concession.value)} {ledger.concession.reason ? `· ${ledger.concession.reason}` : ''}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted">No concession</span>
                )}
                {canManage && <Button size="sm" variant="ghost" icon={BadgePercent} onClick={() => setConcOpen(true)}>{ledger.concession ? 'Change' : 'Add concession'}</Button>}
              </div>
            </Card>

            <Card
              title="Fee lines"
              actions={
                <>
                  <Button size="sm" onClick={selectTillToday}>Due till today</Button>
                  <Button size="sm" onClick={selectAllDue}>All due</Button>
                  <Button size="sm" variant="ghost" onClick={() => setPicked({})}>Clear</Button>
                </>
              }
            >
              {!ledger.installments.length && <p className="text-sm text-warning">No installments / fee structure set for this session.</p>}
              <div className="space-y-4">
                {ledger.installments.map((inst) => (
                  <div key={inst.id} className="rounded-2xl p-4 shadow-neu-in-sm">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <button onClick={() => selectInstallment(inst)} className="flex items-center gap-2 text-sm font-semibold hover:text-primary" disabled={inst.totals.due === 0}>
                        {inst.name}
                        <span className="text-xs font-normal text-muted">due {formatDate(inst.dueDate)}</span>
                        {inst.overdue && <Badge tone="danger">Overdue</Badge>}
                        {inst.totals.due === 0 && inst.totals.payable > 0 && <Badge tone="success">Paid</Badge>}
                      </button>
                      <span className="text-sm tabular-nums text-muted">Due {formatMoney(inst.totals.due)}</span>
                    </div>
                    <table className="w-full text-sm">
                      <tbody>
                        {inst.lines.map((l) => {
                          const on = picked[lineKey(l)] !== undefined;
                          return (
                            <tr key={lineKey(l)} className={clsx('border-t border-line/60', l.due === 0 && 'text-muted')}>
                              <td className="w-8 py-2">
                                <input type="checkbox" disabled={l.due === 0} checked={on} onChange={() => toggleLine(l)} className="h-4 w-4 accent-[rgb(var(--primary))]" aria-label={`Pay ${l.head} ${inst.name}`} />
                              </td>
                              <td className="py-2">{l.head}{l.concession > 0 && <span className="ml-1 text-xs text-success">(−{formatMoney(l.concession)})</span>}</td>
                              <td className="py-2 text-right tabular-nums text-muted">{l.paid > 0 ? `paid ${formatMoney(l.paid)}` : ''}</td>
                              <td className="w-36 py-1.5 pl-3 text-right">
                                {on ? (
                                  <input type="number" min={0} max={l.due} step="0.01" value={picked[lineKey(l)]} onChange={(ev) => setPicked({ ...picked, [lineKey(l)]: ev.target.value })} className="w-full rounded-lg bg-base px-2 py-1 text-right tabular-nums shadow-neu-in-sm outline-none" aria-label={`Amount for ${l.head}`} />
                                ) : (
                                  <span className="tabular-nums">{formatMoney(l.due)}</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div>
            <Card title="Payment" className="sticky top-28">
              <div className="space-y-4">
                <Input label="Date" type="date" value={form.paymentDate} onChange={(ev) => setForm({ ...form, paymentDate: ev.target.value })} />
                <Select label="Mode" value={form.mode} onChange={(ev) => setForm({ ...form, mode: ev.target.value })} options={MODES} />
                {form.mode !== 'cash' && <Input label="Reference / UTR / cheque no." value={form.reference} onChange={(ev) => setForm({ ...form, reference: ev.target.value })} />}
                <Input
                  label="Discount (₹)"
                  type="number"
                  min={0}
                  value={form.discount}
                  disabled={!canManage && !clearsAll}
                  onChange={(ev) => setForm({ ...form, discount: ev.target.value })}
                  hint={clearsAll && ledger.fullPaymentDiscount > 0 ? `Full-payment discount up to ${formatMoney(ledger.fullPaymentDiscount)}` : canManage ? 'Manual discount (fee manager)' : 'Allowed only when all dues are cleared'}
                />
                <Input label="Late fee (₹)" type="number" min={0} value={form.fine} onChange={(ev) => setForm({ ...form, fine: ev.target.value })} hint={ledger.suggestedFine > 0 ? `Suggested ${formatMoney(ledger.suggestedFine)} (${ledger.overdueInstallments} overdue)` : undefined} />
                <Input label="Remarks" value={form.remarks} onChange={(ev) => setForm({ ...form, remarks: ev.target.value })} />

                <div className="space-y-1 rounded-2xl p-4 text-sm shadow-neu-in-sm">
                  <div className="flex justify-between"><span className="text-muted">Selected</span><span className="tabular-nums">{formatMoney(gross)}</span></div>
                  {Number(form.discount) > 0 && <div className="flex justify-between"><span className="text-muted">Discount</span><span className="tabular-nums">− {formatMoney(Number(form.discount))}</span></div>}
                  {Number(form.fine) > 0 && <div className="flex justify-between"><span className="text-muted">Late fee</span><span className="tabular-nums">+ {formatMoney(Number(form.fine))}</span></div>}
                  <div className="flex justify-between border-t border-line pt-2 text-[1rem] font-semibold"><span>Total</span><span className="tabular-nums text-primary">{formatMoney(net)}</span></div>
                </div>
                <Button variant="primary" size="lg" icon={IndianRupee} className="w-full justify-center" disabled={gross <= 0} loading={c.isLoading} onClick={submit}>
                  Collect {gross > 0 ? formatMoney(net) : ''}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {concOpen && <ConcessionModal enrollmentId={enrollmentId} current={ledger?.concession} onClose={() => setConcOpen(false)} />}
    </>
  );
}
