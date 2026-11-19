import clsx from 'clsx';
import { Ban, FileCheck2, IndianRupee, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { openPdf } from '../../../utils/files';
import { formatDateTime } from '../../../utils/format';

const KIND = {
  admission: { icon: UserPlus, tone: 'text-primary', label: 'Admission' },
  payment: { icon: IndianRupee, tone: 'text-success', label: 'Fee' },
  cancelled: { icon: Ban, tone: 'text-danger', label: 'Cancelled' },
  certificate: { icon: FileCheck2, tone: 'text-warning', label: 'Certificate' },
};

/** "x min ago" for today, otherwise the date and time */
const when = (at) => {
  const diff = (Date.now() - new Date(at).getTime()) / 60000;
  if (diff < 1) return 'just now';
  if (diff < 60) return `${Math.floor(diff)} min ago`;
  if (diff < 24 * 60 && new Date(at).toDateString() === new Date().toDateString()) return `${Math.floor(diff / 60)} hr ago`;
  return formatDateTime(at);
};

/** Latest admissions, fee receipts and certificates (each row opens the related page/PDF) */
export default function RecentActivity({ items = [] }) {
  if (!items.length) return <p className="py-8 text-center text-sm text-muted">No activity yet in this session.</p>;
  return (
    <ul className="divide-y divide-line/60">
      {items.map((a, i) => {
        const k = KIND[a.type] ?? KIND.admission;
        const body = (
          <>
            <span className={clsx('neu-inset flex h-9 w-9 shrink-0 items-center justify-center', k.tone)}>
              <k.icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{a.title}</span>
              <span className="block truncate text-xs text-muted">{a.detail}</span>
            </span>
            <span className="shrink-0 text-right text-[11px] text-muted">{when(a.at)}</span>
          </>
        );
        const cls = 'flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-primary/5';
        return (
          <li key={`${a.type}-${i}`}>
            {a.paymentId ? (
              <button type="button" className={cls} onClick={() => openPdf(`/fees/payments/${a.paymentId}/receipt.pdf`, undefined, 'Fee receipt')}>{body}</button>
            ) : a.certificateId ? (
              <button type="button" className={cls} onClick={() => openPdf(`/students/certificates/${a.certificateId}/pdf`, undefined, a.title)}>{body}</button>
            ) : a.studentId ? (
              <Link to={`/students/${a.studentId}`} className={cls}>{body}</Link>
            ) : (
              <div className={cls}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
