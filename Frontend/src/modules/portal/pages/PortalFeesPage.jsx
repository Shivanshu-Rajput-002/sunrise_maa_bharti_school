import { Printer } from 'lucide-react';
import { useGetChildFeesQuery } from '../../../api/opsApi';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import Loader from '../../../components/common/Loader';
import StatCard from '../../../components/common/StatCard';
import { openPdf } from '../../../utils/files';
import { formatDate, formatMoney } from '../../../utils/format';
import { Empty, PortalTitle, RequireEnrollment } from '../components/PortalShared';

function Fees({ child }) {
  const { data, isLoading, error } = useGetChildFeesQuery(child.id);
  if (isLoading) return <Loader />;
  if (error) return <p className="text-sm text-danger">{error.message}</p>;
  const t = data.totals;

  return (
    <>
      <PortalTitle title="Fees Master" subtitle={`${child.name} · full fee structure and payments for this session`} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total fee" value={formatMoney(t.amount)} />
        <StatCard label="Concession" value={formatMoney(t.concession)} hint={data.concession ? (data.concession.type === 'percent' ? `${data.concession.value}%` : 'Fixed') : 'None'} tone="warning" />
        <StatCard label="Paid" value={formatMoney(t.paid)} tone="success" />
        <StatCard label="Balance" value={formatMoney(t.due)} tone={t.due > 0 ? 'danger' : 'success'} />
      </div>

      <div className="mt-6 grid gap-5 sm:gap-6 xl:grid-cols-2">
        {data.installments.map((i) => (
          <Card
            key={i.id}
            title={i.name}
            subtitle={`Due date ${formatDate(i.dueDate)}`}
            actions={i.totals.due === 0 ? <Badge tone="success">Paid</Badge> : i.overdue ? <Badge tone="danger">Overdue</Badge> : <Badge tone="warning">Pending</Badge>}
          >
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="text-xs uppercase text-muted">
                    <th className="py-2 text-left font-medium">Fee head</th>
                    <th className="text-right font-medium">Amount</th>
                    <th className="text-right font-medium">Paid</th>
                    <th className="text-right font-medium">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {i.lines.map((l) => (
                    <tr key={`${l.feeHeadId}-${l.head}`} className="border-t border-line/60">
                      <td className="py-2">
                        {l.head}
                        {l.concession > 0 && <span className="block text-xs text-muted">Concession {formatMoney(l.concession)}</span>}
                      </td>
                      <td className="text-right tabular-nums">{formatMoney(l.payable)}</td>
                      <td className="text-right tabular-nums">{formatMoney(l.paid)}</td>
                      <td className={`text-right tabular-nums ${l.due > 0 ? 'text-danger' : ''}`}>{formatMoney(l.due)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-line font-semibold">
                    <td className="py-2">Total</td>
                    <td className="text-right tabular-nums">{formatMoney(i.totals.payable)}</td>
                    <td className="text-right tabular-nums">{formatMoney(i.totals.paid)}</td>
                    <td className="text-right tabular-nums">{formatMoney(i.totals.due)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        ))}
      </div>

      <Card title="Payment receipts" subtitle="A receipt appears here once the school has collected the fee" className="mt-6">
        {data.receipts.length ? (
          <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {data.receipts.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 shadow-neu-in-sm">
                <span className="min-w-0 text-sm">
                  <span className="block font-medium">{r.receiptNo}</span>
                  <span className="block text-xs text-muted">{formatDate(r.paymentDate)} · {r.mode.toUpperCase()}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="font-semibold tabular-nums">{formatMoney(Number(r.netAmount))}</span>
                  <Button size="icon-sm" icon={Printer} aria-label="Download receipt" onClick={() => openPdf(`/portal/children/${child.id}/receipts/${r.id}/pdf`, undefined, `Fee receipt ${r.receiptNo}`)} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No payments yet.</Empty>
        )}
      </Card>
    </>
  );
}

export default function PortalFeesPage() {
  return <RequireEnrollment>{(child) => <Fees key={child.id} child={child} />}</RequireEnrollment>;
}
