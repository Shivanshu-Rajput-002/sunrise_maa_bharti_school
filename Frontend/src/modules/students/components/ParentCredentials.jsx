import { Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';

const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Printable login slips (cut along the dashed lines and send home with the child) */
export function printSlips(rows, schoolName) {
  const url = window.location.origin;
  const slips = rows
    .map(
      (r) => `<div class="slip">
        <div class="h">${escapeHtml(schoolName)} — Parent Portal Login</div>
        <table>
          <tr><td>Student</td><td><b>${escapeHtml(r.student)}</b> (${escapeHtml(r.admissionNo)}) ${r.className ? `· Class ${escapeHtml(r.className)}` : ''}</td></tr>
          <tr><td>Parent</td><td>${escapeHtml(r.parentName)}</td></tr>
          <tr><td>Website</td><td>${escapeHtml(url)}</td></tr>
          <tr><td>Username</td><td><b class="mono">${escapeHtml(r.username)}</b></td></tr>
          <tr><td>Password</td><td><b class="mono">${escapeHtml(r.password)}</b></td></tr>
        </table>
        <div class="n">Login to see fees, attendance, results, admit card, bus GPS and notices. Please keep this password private.</div>
      </div>`,
    )
    .join('');
  const w = window.open('', '_blank');
  if (!w) return toast.error('Allow pop-ups to print the slips');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Parent login slips</title><style>
    body{font-family:Arial,sans-serif;margin:10mm;color:#111}
    .slip{border:1px dashed #555;padding:10px 14px;margin-bottom:8mm;page-break-inside:avoid}
    .h{font-weight:bold;font-size:15px;margin-bottom:6px}
    table{border-collapse:collapse;font-size:13px} td{padding:2px 10px 2px 0;vertical-align:top} td:first-child{color:#555;width:80px}
    .mono{font-family:Consolas,monospace;font-size:15px;letter-spacing:1px}
    .n{font-size:11px;color:#555;margin-top:6px}
  </style></head><body>${slips}<script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
}

/** Shows generated passwords once, with print / copy */
export function CredentialsModal({ result, schoolName, onClose }) {
  const printable = result.rows.filter((r) => r.password);
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={result.title}
      footer={<><Button onClick={onClose}>Close</Button><Button variant="primary" icon={Printer} disabled={!printable.length} onClick={() => printSlips(printable, schoolName)}>Print login slips ({printable.length})</Button></>}
    >
      {result.summary && <p className="mb-3 text-sm">{result.summary}</p>}
      <p className="mb-4 text-sm text-warning">Passwords are shown only now — print the slips or note them before closing.</p>
      <div className="neu-inset max-h-[50vh] overflow-auto p-1">
        <table className="w-full min-w-[560px] text-sm">
          <thead><tr className="text-xs uppercase text-muted"><th className="px-3 py-2 text-left">Student</th><th className="px-3 py-2 text-left">Username</th><th className="px-3 py-2 text-left">Password</th><th className="px-3 py-2 text-left">Status</th></tr></thead>
          <tbody>
            {result.rows.map((r, i) => (
              <tr key={i} className="border-t border-line/60">
                <td className="px-3 py-1.5">{r.student}<span className="block text-xs text-muted">{r.admissionNo}{r.className ? ` · ${r.className}` : ''}</span></td>
                <td className="px-3 py-1.5 font-mono">{r.username || '—'}</td>
                <td className="px-3 py-1.5 font-mono font-semibold">{r.password ?? '—'}</td>
                <td className="px-3 py-1.5">
                  <Badge tone={r.status === 'created' ? 'success' : r.status === 'linked' ? 'primary' : 'neutral'}>{r.status}</Badge>
                  {r.note && <span className="block text-xs text-muted">{r.note}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

