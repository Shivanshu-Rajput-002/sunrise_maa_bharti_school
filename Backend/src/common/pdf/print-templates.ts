/**
 * HTML templates that reproduce the old school documents (receipt, admit card,
 * character / study certificate, marksheet). Printed by HtmlPdfService.
 * All dynamic text goes through esc().
 */
import type { PrintSettings } from '../../modules/admin/services/settings.service';
import { esc } from './html-pdf.service';

// ---------- formatting helpers ----------
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const parts = (d?: string | null) => (d ? /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d)) : null);

/** 2026-10-31 → 31-10-2026 */
export const dmy = (d?: string | null) => {
  const m = parts(d);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
};
/** 2026-10-10 → 10-Oct-2026 */
export const dMonY = (d?: string | null) => {
  const m = parts(d);
  return m ? `${m[3]}-${MONTHS[Number(m[2]) - 1].slice(0, 3)}-${m[1]}` : '';
};
export const dayName = (d?: string | null) => {
  const m = parts(d);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }) : '';
};

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const ORD = ['', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth', 'Thirteenth', 'Fourteenth', 'Fifteenth', 'Sixteenth', 'Seventeenth', 'Eighteenth', 'Nineteenth', 'Twentieth', 'Twenty First', 'Twenty Second', 'Twenty Third', 'Twenty Fourth', 'Twenty Fifth', 'Twenty Sixth', 'Twenty Seventh', 'Twenty Eighth', 'Twenty Ninth', 'Thirtieth', 'Thirty First'];
const words = (n: number): string => {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : '');
  if (n < 1000) return `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${words(n % 100)}` : ''}`;
  return `${words(Math.floor(n / 1000))} Thousand${n % 1000 ? ` ${words(n % 1000)}` : ''}`;
};
/** 2013-01-10 → Tenth January Two Thousand Thirteen (as on the old marksheet) */
export const dateToWords = (d?: string | null) => {
  const m = parts(d);
  return m ? `${ORD[+m[3]]} ${MONTHS[+m[2] - 1]} ${words(+m[1])}` : '';
};
const num = (v: number | null | undefined) => (v == null ? '' : String(Math.round(v * 100) / 100));
/** Blank instead of 0 (Total Max row for exams not held yet) */
const nz = (v: number | null | undefined) => (!v ? '' : num(v));
const pct = (v: number | null | undefined) => (v == null ? '' : `${Math.round(v * 100) / 100}%`);

const page = (css: string, body: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box} body{margin:0;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .hi{font-family:"Nirmala UI","Mangal","Noto Sans Devanagari","Lohit Devanagari",sans-serif}
  .brk{page-break-after:always;break-after:page} .brk:last-child{page-break-after:auto;break-after:auto}
  ${css}</style></head><body>${body}</body></html>`;

// =====================================================================
// FEE RECEIPT — two copies side by side (school / student)
// =====================================================================
export interface ReceiptView {
  logo: string;
  print: PrintSettings;
  receiptNo: string;
  date: string;
  studentName: string;
  fatherName: string;
  address: string;
  className: string;
  batch: string;
  lines: { head: string; amount: number }[];
  discount: number;
  fine: number;
  total: number;
  inWords: string;
  mode: string;
  receivedBy: string;
  totalPayable: number;
  dueAmount: number;
  nextDueDate: string | null;
  cancelled: boolean;
  /** Parent portal: one copy, no "Copy for …" label (school prints both copies) */
  single?: boolean;
}

export function receiptHtml(r: ReceiptView) {
  const copy = (label: string) => `
  <div class="copy">
    ${label ? `<div class="label">${label}</div>` : ''}
    <div class="box">
      <div class="head">
        ${r.logo ? `<img src="${r.logo}">` : ''}
        <div><div class="sname">${esc(r.print.shortName)}</div><div class="addr">${esc(r.print.address)} Mob. ${esc(r.print.phone)}</div></div>
      </div>
      <div class="info">
        <div class="row"><span>Sr No. : <b class="red">${esc(r.receiptNo)}</b></span><span>Date : ${esc(r.date)}</span></div>
        <table class="kv">
          <tr><td>Name Of Student :</td><td>${esc(r.studentName)}</td></tr>
          <tr><td>Father Name :</td><td>${esc(r.fatherName)}</td></tr>
          <tr><td>Address :</td><td>${esc(r.address)}</td></tr>
          <tr><td>Class :</td><td>${esc(r.className)}</td></tr>
          <tr><td>Batch :</td><td>${esc(r.batch)}</td></tr>
        </table>
      </div>
      <div class="fees">
        <table class="lines">
          ${r.lines.map((l, i) => `<tr><td class="n">${i + 1}</td><td class="h">${esc(l.head)}</td><td>Rs. ${num(l.amount)}</td></tr>`).join('')}
          ${r.discount > 0 ? `<tr><td></td><td class="h">Discount</td><td>- Rs. ${num(r.discount)}</td></tr>` : ''}
          ${r.fine > 0 ? `<tr><td></td><td class="h">Late Fee</td><td>Rs. ${num(r.fine)}</td></tr>` : ''}
          <tr><td></td><td class="h tot">Total :</td><td><b>Rs. ${num(r.total)}</b></td></tr>
        </table>
        <div class="foot">
          <p>In words : ${esc(r.inWords)}</p>
          <p>By ${esc(r.mode)} : ${esc(r.receivedBy)}</p>
          <p>Total Payble Fee : Rs. ${num(r.totalPayable)}</p>
          <p class="row"><span>Due Amount : Rs. ${num(r.dueAmount)}</span><span>${r.nextDueDate ? `Next Due date : ${esc(r.nextDueDate)}` : ''}</span></p>
          <p class="sign">Authorised Signatory</p>
        </div>
      </div>
      ${r.cancelled ? '<div class="void">CANCELLED</div>' : ''}
    </div>
  </div>`;
  return page(
    `@page{size:A4 ${r.single ? 'portrait' : 'landscape'};margin:10mm}
    body{font-family:Arial,Helvetica,sans-serif;font-size:12.5px;color:#222}
    .wrap{display:flex;gap:14mm;justify-content:center}
    .copy{width:${r.single ? '165mm' : '128mm'}}
    .label{font-size:12px;margin-bottom:2px}
    .box{border:1px solid #000;position:relative}
    .head{display:flex;gap:6px;align-items:flex-start;padding:4px 6px;border-bottom:1px solid #000}
    .head img{width:56px;height:64px;object-fit:contain}
    .sname{font-weight:bold;font-size:16px;text-align:center;color:#333}
    .addr{font-size:12px;text-align:center;color:#444}
    .info{padding:6px 10px;border-bottom:1px solid #000}
    .row{display:flex;justify-content:space-between}
    .red{color:#e53935;font-weight:normal}
    table{border-collapse:collapse;width:100%}
    .kv td{padding:2px 0;vertical-align:top} .kv td:first-child{width:42%}
    .fees{padding:6px 10px}
    .lines td{padding:2px 0} .lines .n{width:8%} .lines .h{width:46%;font-weight:bold} .lines .tot{text-align:right;padding-right:16px}
    .foot p{margin:6px 0}
    .sign{text-align:right;font-weight:bold;margin-top:22px!important}
    .void{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:56px;font-weight:bold;color:rgba(220,38,38,.22);transform:rotate(-20deg)}`,
    r.single ? `<div class="wrap">${copy('')}</div>` : `<div class="wrap">${copy('Copy for School')}${copy('Copy for Student')}</div>`,
  );
}

// =====================================================================
// ADMIT CARD — two per A4 page
// =====================================================================
export interface AdmitView {
  campusLine: string;
  name: string;
  dob: string;
  category: string;
  rollNo: string;
  father: string;
  mother: string;
  village: string;
  mobile: string;
  className: string;
  photo: string;
}
export interface AdmitPage {
  logo: string;
  title: string;
  examLine: string;
  schedule: { date: string; day: string; from: string; to: string; subject: string }[];
  notes: string[];
  students: AdmitView[];
}

/** 13:15 → 01:15 (old admit cards print 12-hour times without AM/PM) */
export const hh12 = (t?: string | null) => {
  if (!t) return '';
  const [h, m] = t.slice(0, 5).split(':').map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/** Note text: **bold** markers, and dates (24-11-2026) are bolded like the old card */
const noteHtml = (n: string) =>
  esc(n)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^>\d])(\d{1,2}[-/.]\d{1,2}[-/.]\d{4})/g, '$1<b>$2</b>');

export function admitCardsHtml(a: AdmitPage) {
  const card = (s: AdmitView) => `
  <div class="card">
    <div class="head">
      ${a.logo ? `<img class="logo" src="${a.logo}">` : '<span class="logo"></span>'}
      <div class="titles"><div class="t1">${esc(a.title)}</div><div class="t2">${esc(s.campusLine)}</div><div class="t3">${esc(a.examLine)}</div></div>
    </div>
    <div class="stu">
      <div class="grid">
        <div>Student : ${esc(s.name)}</div><div>DOB : ${esc(s.dob)}</div><div>Category : ${esc(s.category)}</div>
        <div>Father : ${esc(s.father)}</div><div>Village : ${esc(s.village)}</div><div>Class : ${esc(s.className)}</div>
        <div>Mother : ${esc(s.mother)}</div><div>Mobile : ${esc(s.mobile)}</div><div>Roll No. : ${esc(s.rollNo)}</div>
      </div>
      <div class="photo">${s.photo ? `<img src="${s.photo}">` : ''}</div>
    </div>
    <table class="sch">
      <tr><th>Exam Date</th><th>Day</th><th>Time From</th><th>Time To</th><th>Subject</th></tr>
      ${a.schedule.map((r) => `<tr><td>${esc(r.date)}</td><td>${esc(r.day)}</td><td>${esc(r.from)}</td><td>${esc(r.to)}</td><td>${esc(r.subject)}</td></tr>`).join('')}
    </table>
    <div class="notes">${a.notes.map((n, i) => `<div><b>${i + 1}.</b> ${noteHtml(n)}</div>`).join('')}</div>
  </div>`;
  const pages: string[] = [];
  for (let i = 0; i < a.students.length; i += 2) pages.push(`<div class="brk">${a.students.slice(i, i + 2).map(card).join('')}</div>`);
  return page(
    `@page{size:A4;margin:8mm}
    body{font-family:Arial,Helvetica,sans-serif;font-size:12.5px}
    .card{border:1px solid #000;height:138mm;margin-bottom:4mm;overflow:hidden;display:flex;flex-direction:column}
    .head{display:flex;align-items:center;padding:8px 20px 4px}
    .logo{width:66px;height:80px;object-fit:contain}
    .titles{flex:1;text-align:center;padding-right:66px}
    .t1{font-size:21px} .t2{font-size:10.5px;font-weight:bold;margin-top:4px} .t3{font-size:13px;margin-top:2px}
    .stu{border-top:1px solid #000;border-bottom:1px solid #000;display:flex;min-height:31mm}
    .grid{flex:1;display:grid;grid-template-columns:1fr 1fr 1fr;gap:9px 12px;padding:6px 14px;align-content:start}
    .photo{width:52mm;display:flex;align-items:flex-start;justify-content:center;padding:6px}
    .photo img{width:22mm;height:26mm;object-fit:cover}
    .sch{width:100%;border-collapse:collapse;font-family:"Times New Roman",Times,serif;font-size:14px;margin-top:4px}
    .sch th{text-align:left;padding:4px 6px} .sch td{padding:3px 6px}
    .notes{border-top:1px solid #ccc;margin-top:8px;padding:6px 14px 6px;display:grid;grid-template-columns:1fr 1fr;gap:2px 20px;font-family:"Times New Roman",Times,serif;font-size:13.5px}`,
    pages.join(''),
  );
}

// =====================================================================
// CHARACTER / STUDY CERTIFICATE — Hindi for Hindi medium, English otherwise
// =====================================================================
export interface CertView {
  type: 'character' | 'study';
  hindi: boolean;
  logo: string;
  photo: string;
  print: PrintSettings;
  serialNo: string;
  issuedOn: string;
  name: string;
  female: boolean;
  father: string;
  mother: string;
  address: string;
  dob: string;
  srNo: string;
  className: string;
  session: string;
  nicId: string;
}

export function certificateHtml(c: CertView) {
  const p = c.print;
  const b = (v: string) => `&nbsp;<b>${esc(v)}</b>`;
  const header = c.hindi
    ? `<div class="sn hi">${esc(p.schoolNameHi)}</div><div class="l1 hi">${esc(p.addressHi)}, Mob. ${esc(p.phone)}</div><div class="l2 hi">विद्यालय का PSP कोड - ${esc(p.pspCode)}, DIC कोड - ${esc(p.dicCode)}, बोर्ड कोड - ${esc(p.boardCode)}</div>`
    : `<div class="sn">${esc(c.type === 'study' ? p.schoolName.replace(/\s+BIJOLIYA$/i, '') : p.certName)}</div><div class="l1">${esc(c.type === 'study' ? `${p.address.toUpperCase()} MOB. ${p.phone}` : `${p.address} Mob. ${p.phone}`)}</div><div class="l2">${esc(
        c.type === 'study' ? `SCHOOL'S PSP CODE - ${p.pspCode}, DIC CODE - ${p.dicCode}, BOARD CODE - ${p.boardCode}` : `School's PSP Code - ${p.pspCode}, DIC Code - ${p.dicCode}, Board Code - ${p.boardCode}`,
      )}</div>`;
  const ch = c.female ? 'छात्रा' : 'छात्र';
  let title: string;
  let body: string;
  if (c.type === 'character') {
    title = c.hindi ? 'चरित्र प्रमाण पत्र' : 'Character Certificate';
    body = c.hindi
      ? `यह प्रमाणित किया जाता है कि ${ch} ${b(c.name)}, पिता ${b(c.father)} गांव ${b(c.address)} <b>है</b>.<br><br>हमारी जानकारी के अनुसार, ${ch} का व्यवहार उत्कृष्ट है।<br><br>दी गई जानकारी सही और स्पष्ट है, विद्यालय ${ch} के उज्ज्वल भविष्य की कामना करता है।`
      : `It is certified that the Student ${b(c.name)}, Father ${b(c.father)} City / Village ${b(c.address)}.<br><br>According to our information, the student's behavior is excellent.<br><br>The provided information is correct and clear, wishing for a bright future for school students.`;
  } else {
    title = c.hindi ? 'अध्यनरत प्रमाण पत्र' : 'Study Certificate';
    body = c.hindi
      ? `यह प्रमाणित किया जाता है कि ${ch} ${b(c.name)} , पिता ${b(c.father)} , माता का नाम : ${b(c.mother)} , गांव ${b(c.address)} <b>है |</b> . जन्म दिनांक ${b(c.dob)} , NIC ID - ${esc(c.nicId)} , S.R.- ${b(c.srNo)} , कक्षा - ${b(c.className)} ,सत्र - ${b(c.session)} &nbsp; का एक नियमित ${ch} है<br><br>हमारी जानकारी के अनुसार, दी गई जानकारी सही और स्पष्ट है |`
      : `It is certified that the Student ${b(c.name)}, Father ${b(c.father)}, Mother's Name : ${esc(c.mother)}, City / Village ${b(c.address)}. Date of Birth ${b(c.dob)} S.R.- ${b(c.srNo)} is a Regular student of Class - ${b(c.className)}, Session - ${b(c.session)}<br>NIC ID - ${esc(c.nicId)},<br><br>According to our information, The provided information is correct and clear.`;
  }
  return page(
    `@page{size:A4;margin:10mm}
    body{font-family:"Times New Roman",Times,serif}
    .cert{border:1px solid #000;padding-bottom:10px}
    .band{display:flex;align-items:center;background:#1c5bad;color:#fff;padding:8px 24px}
    .band img{width:78px;height:86px;object-fit:contain;background:#fff}
    .band .txt{flex:1;text-align:center;line-height:1.3}
    .sn{font-size:26px} .sn:not(.hi){font-weight:bold;font-size:22px}
    .l1{font-size:${c.type === 'character' ? 16 : 14}px;font-weight:bold;white-space:nowrap}
    .l2{font-size:${c.type === 'character' ? 15.5 : 14}px;font-weight:${c.type === 'character' ? 'bold' : 'normal'};white-space:nowrap}
    h3{text-align:center;font-weight:normal;margin:${c.type === 'study' ? '26px 0 10px' : '12px 0 8px'};font-size:${c.type === 'study' ? 24 : 16}px}
    h3 span{text-decoration:${c.type === 'study' ? 'underline' : 'none'}}
    .content{display:flex;gap:24px;padding:8px 20px;font-family:Arial,"Nirmala UI","Mangal",sans-serif;font-size:14.5px;line-height:1.5}
    .content p{flex:1;margin:0}
    .content img{width:${c.type === 'study' ? 30 : 24}mm;border:1px solid #000;align-self:flex-start;margin-right:10px}
    .sign{text-align:right;padding:36px 14px 0;font-family:Arial,sans-serif;font-size:14px}`,
    `<div class="cert">
      <div class="band">${c.logo ? `<img src="${c.logo}">` : ''}<div class="txt">${header}</div></div>
      <h3 class="${c.hindi ? 'hi' : ''}"><span>${title}</span></h3>
      <div class="content"><p class="${c.hindi ? 'hi' : ''}">${body}</p>${c.photo ? `<img src="${c.photo}">` : ''}</div>
      <div class="sign">Principal Signature</div>
    </div>`,
  );
}

// =====================================================================
// MARKSHEET (progress report) — four layouts, same as the old site
// =====================================================================
export type MarksheetLayout = 'primary' | 'secondary' | 'senior' | 'english';

export interface MarkCell {
  th: number | null;
  pr: number | null;
  total: number | null;
  max: number;
  thMax: number;
  prMax: number | null;
  absent: boolean;
}
export interface MarksheetSubject {
  name: string;
  additional: boolean;
  cells: Partial<Record<string, MarkCell>>;
}
export interface MarksheetView {
  layout: MarksheetLayout;
  logo: string;
  photo: string;
  print: PrintSettings;
  campus: string;
  session: string;
  student: { name: string; father: string; mother: string; dob: string; dobWords: string; className: string; rollNo: string; srNo: string };
  /** column code → max marks configured (for the header row) */
  colMax: Partial<Record<string, number>>;
  colSplit: Partial<Record<string, { th: number; pr: number | null }>>;
  subjects: MarksheetSubject[];
  overall: { percent: number | null; division: string; result: string; rank: number | null };
  declarationDate: string;
  meetings: number | null;
  attended: number | null;
  extras: MarksheetExtras;
  grade: (pct: number) => string;
}
type CoTerm = { work?: string; art?: string; health?: string; discipline?: string };
export interface MarksheetExtras {
  supw?: { comp?: number; opt?: number; camp?: number };
  art?: { theory?: number; practical?: number; assignment?: number };
  jeevan?: { based?: number; assignment?: number; annual?: number };
  coScholastic?: { t1?: CoTerm; t2?: CoTerm };
  health?: { t1?: { height?: string; weight?: string }; t2?: { height?: string; weight?: string } };
  remark?: string;
  totalMeetings?: number | null;
  attendance?: number | null;
}

const sum = (xs: (number | null | undefined)[]) => (xs.some((x) => x != null) ? xs.reduce<number>((n, x) => n + (x ?? 0), 0) : null);
const cellVal = (c?: MarkCell) => (c ? (c.absent ? 'AB' : num(c.total)) : '');

export function marksheetHtml(v: MarksheetView) {
  const p = v.print;
  const s = v.student;
  const header = `
  <table class="hdr"><tr>
    <td class="lg">${v.logo ? `<img src="${v.logo}">` : ''}</td>
    <td class="tt">
      <div class="dep">${esc(p.department)}</div>
      <div class="sch">${esc(p.schoolName)}</div>
      <div class="cmp">( UDISE CODE - ${esc(p.udiseCode)} ) ${esc(v.campus)} ${esc(p.phone)}</div>
      <div class="prg">PROGRESS REPORT ${esc(v.session)}</div>
    </td></tr></table>
  <table class="info">
    <tr><td class="k">Student</td><td colspan="3">${esc(s.name)}</td><td rowspan="5" class="ph">${v.photo ? `<img src="${v.photo}">` : ''}</td></tr>
    <tr><td class="k">Father</td><td colspan="3">${esc(s.father)}</td></tr>
    <tr><td class="k">Mother</td><td colspan="3">${esc(s.mother)}</td></tr>
    <tr><td class="k">DOB</td><td>${esc(s.dob)}</td><td><b>${esc(s.dobWords)}</b></td><td></td></tr>
    <tr><th class="k">Class</th><td>${esc(s.className)}</td><th>Roll No. : ${esc(s.rollNo)}</th><th>Sr No. : ${esc(s.srNo)}</th></tr>
  </table>`;

  const main = v.subjects.filter((x) => !x.additional);
  const extra = v.subjects.filter((x) => x.additional);
  const mx = (c: string) => v.colMax[c] ?? 0;
  const colTotal = (code: string, list = main) => sum(list.map((x) => x.cells[code]?.total));
  const maxTotal = (code: string, list = main) => list.reduce((n, x) => n + (x.cells[code]?.max ?? 0), 0);
  const P = (o: number | null, m: number) => (o == null || !m ? '' : pct((o / m) * 100));

  let table = '';
  let below = '';

  if (v.layout === 'primary') {
    const cols = ['T1', 'T2', 'T3', 'HY', 'AN'];
    const grand = (x: MarksheetSubject) => sum(cols.map((c) => x.cells[c]?.total));
    const gMax = (x: MarksheetSubject) => cols.reduce((n, c) => n + (x.cells[c]?.max ?? 0), 0);
    const totals = cols.map((c) => colTotal(c));
    const gt = sum(main.map(grand));
    const gtMax = main.reduce((n, x) => n + gMax(x), 0);
    table = `<table class="mk">
      <tr><td rowspan="2">Subject</td><td>Test 1</td><td>Test 2</td><td>Test 3</td><td>Half Yearly</td><td>Yearly</td><td class="red b">Grand Total</td><td>Percentage</td></tr>
      <tr>${cols.map((c) => `<td>${num(mx(c))}</td>`).join('')}<td class="red">${num(cols.reduce((n, c) => n + mx(c), 0))}</td><td>%</td></tr>
      ${main.map((x) => `<tr><td>${esc(x.name)}</td>${cols.map((c) => `<td>${cellVal(x.cells[c])}</td>`).join('')}<td class="red">${num(grand(x))}</td><td>${P(grand(x), gMax(x))}</td></tr>`).join('')}
      <tr><td>Total</td>${totals.map((t) => `<td>${num(t)}</td>`).join('')}<td class="red">${num(gt)}</td><td></td></tr>
      <tr><td>Percentage</td>${cols.map((c, i) => `<td>${P(totals[i], maxTotal(c))}</td>`).join('')}<td class="red">${P(gt, gtMax)}</td><td></td></tr>
      ${extra.map((x) => `<tr><td>${esc(x.name)}</td>${cols.map((c) => `<td>${cellVal(x.cells[c])}</td>`).join('')}<td class="red">${num(grand(x))}</td><td>${P(grand(x), gMax(x))}</td></tr>`).join('')}
      <tr class="gap"><td colspan="8"></td></tr>
      <tr class="res"><th colspan="2">Division : ${esc(v.overall.division)}</th><th>Result : ${esc(v.overall.result)}</th><th colspan="3">Declaration Date : ${esc(v.declarationDate)}</th><th colspan="2">Rank : ${v.overall.rank ?? ''}</th></tr>
      <tr class="gap"><td colspan="8"></td></tr>
      <tr class="sg"><th colspan="2">Sign of Class teacher</th><td></td><td colspan="5" rowspan="2" class="pr">Principal</td></tr>
      <tr class="sg"><th colspan="2">Sign of Parent</th><td></td></tr>
    </table>`;
  } else if (v.layout === 'secondary') {
    const tcols = ['T1', 'T2', 'T3', 'HY'];
    const tot1 = (x: MarksheetSubject) => sum(tcols.map((c) => x.cells[c]?.total));
    const tot1Max = (x: MarksheetSubject) => tcols.reduce((n, c) => n + (x.cells[c]?.max ?? 0), 0);
    const an = (x: MarksheetSubject) => x.cells.AN?.total ?? null;
    const anMax = (x: MarksheetSubject) => x.cells.AN?.max ?? 0;
    const grand = (x: MarksheetSubject) => sum([tot1(x), an(x)]);
    const gMax = (x: MarksheetSubject) => tot1Max(x) + anMax(x);
    const row = (x: MarksheetSubject) =>
      `<tr><td>${esc(x.name)}</td>${tcols.map((c) => `<td>${cellVal(x.cells[c])}</td>`).join('')}<td class="red">${num(tot1(x))}</td><td>${x.cells.AN?.absent ? 'AB' : num(an(x))}</td><td class="red">${num(grand(x))}</td><td>${P(grand(x), gMax(x))}</td></tr>`;
    const T = tcols.map((c) => colTotal(c));
    const t1 = sum(main.map(tot1));
    const ta = sum(main.map(an));
    const tg = sum(main.map(grand));
    const M = tcols.map((c) => maxTotal(c));
    const m1 = main.reduce((n, x) => n + tot1Max(x), 0);
    const ma = main.reduce((n, x) => n + anMax(x), 0);
    const e = v.extras;
    const supwT = sum([e.supw?.comp, e.supw?.opt, e.supw?.camp]);
    const artT = sum([e.art?.theory, e.art?.practical, e.art?.assignment]);
    table = `<table class="mk">
      <tr><td rowspan="2" class="w">Subject</td><td>First Test</td><td>Second Test</td><td>Third Test</td><td>Half Yearly</td><td class="red">Total</td><td>Annual</td><td class="red">Grand Total</td><td>Percentage</td></tr>
      <tr>${tcols.map((c) => `<td>${num(mx(c))}</td>`).join('')}<td class="red">${num(tcols.reduce((n, c) => n + mx(c), 0))}</td><td>${num(mx('AN'))}</td><td class="red">${num(tcols.reduce((n, c) => n + mx(c), 0) + mx('AN'))}</td><td>%</td></tr>
      ${main.map(row).join('')}
      <tr><td>Total</td>${T.map((t) => `<td>${num(t)}</td>`).join('')}<td class="red">${num(t1)}</td><td>${num(ta)}</td><td class="red">${num(tg)}</td><td></td></tr>
      <tr><td>Total Max Marks</td>${M.map((m) => `<td>${nz(m)}</td>`).join('')}<td class="red">${nz(m1)}</td><td>${nz(ma)}</td><td class="red">${nz(m1 + ma)}</td><td></td></tr>
      <tr><td>Percentage</td>${T.map((t, i) => `<td>${P(t, M[i])}</td>`).join('')}<td class="red">${P(t1, m1)}</td><td>${P(ta, ma)}</td><td class="red">${P(tg, m1 + ma)}</td><td></td></tr>
      <tr class="gap"><td colspan="9"></td></tr>
      ${extra.map(row).join('')}
      <tr><td></td><th>Compls Act.</th><th>Opt Act</th><th>Camp</th><th>Total</th><th>Grade</th><td></td><td></td><td></td></tr>
      <tr><td>S.U.P.W From Marks</td><td>25</td><td>45</td><td>30</td><td>100</td><td></td><td></td><td></td><td></td></tr>
      <tr><td>Obtained Marks</td><td>${num(e.supw?.comp)}</td><td>${num(e.supw?.opt)}</td><td>${num(e.supw?.camp)}</td><td>${num(supwT)}</td><td>${supwT != null ? v.grade(supwT) : ''}</td><td></td><td></td><td></td></tr>
      <tr><td></td><th>Theory</th><th>Practical</th><th>Assignment</th><th>Total</th><th>Grade</th><td></td><td></td><td></td></tr>
      <tr><td>Art Edu. Marks</td><td>25</td><td>60</td><td>15</td><td>100</td><td></td><td></td><td></td><td></td></tr>
      <tr><td>Obtained Marks</td><td>${num(e.art?.theory)}</td><td>${num(e.art?.practical)}</td><td>${num(e.art?.assignment)}</td><td>${num(artT)}</td><td>${artT != null ? v.grade(artT) : ''}</td><td></td><td></td><td></td></tr>
      ${resultBlock(v, 9, [3, 2, 2, 2])}
    </table>`;
  } else if (v.layout === 'senior') {
    const tcols = ['T1', 'T2', 'T3'];
    const sp = (c: string) => v.colSplit[c] ?? { th: mx(c), pr: null };
    const hy = (x: MarksheetSubject) => x.cells.HY?.total ?? null;
    const hyt = (x: MarksheetSubject) => sum([...tcols.map((c) => x.cells[c]?.total), hy(x)]);
    const an = (x: MarksheetSubject) => x.cells.AN?.total ?? null;
    const st = (x: MarksheetSubject) => sum([hyt(x), an(x)]);
    const stMax = (x: MarksheetSubject) => [...tcols, 'HY', 'AN'].reduce((n, c) => n + (x.cells[c]?.max ?? 0), 0);
    const dash = (x: MarksheetSubject, c: string, part: 'th' | 'pr') => {
      const cell = x.cells[c];
      if (!cell) return '';
      if (cell.absent) return 'AB';
      if (part === 'pr' && cell.prMax == null) return '-';
      return num(part === 'th' ? cell.th : cell.pr);
    };
    const row = (x: MarksheetSubject) =>
      `<tr><td>${esc(x.name)}</td>${tcols.map((c) => `<td>${cellVal(x.cells[c])}</td>`).join('')}<td>${dash(x, 'HY', 'th')}</td><td>${dash(x, 'HY', 'pr')}</td><td class="red">${num(hy(x))}</td><td>${num(hyt(x))}</td><td>${dash(x, 'AN', 'th')}</td><td>${dash(x, 'AN', 'pr')}</td><td class="red">${num(an(x))}</td><td class="grn">${num(st(x))}</td><td>${P(st(x), stMax(x))}</td></tr>`;
    const thHdr = (c: string) => {
      const ths = [...new Set(main.map((x) => x.cells[c]?.thMax).filter((n): n is number => n != null))];
      return ths.length ? ths.map(num).join('/') : num(sp(c).th);
    };
    const prHdr = (c: string) => {
      const prs = [...new Set(main.map((x) => x.cells[c]?.prMax).filter((n): n is number => n != null))];
      return prs.length ? prs.map(num).join('/') : '';
    };
    const T = tcols.map((c) => colTotal(c));
    const tHy = sum(main.map(hy));
    const tHyt = sum(main.map(hyt));
    const tAn = sum(main.map(an));
    const tSt = sum(main.map(st));
    const M = tcols.map((c) => maxTotal(c));
    const mHyt = main.reduce((n, x) => n + [...tcols, 'HY'].reduce((k, c) => k + (x.cells[c]?.max ?? 0), 0), 0);
    const mAn = maxTotal('AN');
    const mSt = mHyt + mAn;
    const j = v.extras.jeevan ?? {};
    const jT = sum([j.based, j.assignment, j.annual]);
    table = `<table class="mk sm">
      <tr><th class="w">Subject</th><th>First Test</th><th>Second Test</th><th>Third Test</th><th>HYE TH</th><th>HYE PRCT</th><th class="red">Total HYE</th><th>Total HYE + Test</th><th>Annual TH</th><th>Annual PRCT</th><th class="red">Total Annual</th><th class="grn">Subject Total</th><th>Percent</th></tr>
      <tr><td>Maximum Marks</td>${tcols.map((c) => `<td>${num(mx(c))}</td>`).join('')}<td>${thHdr('HY')}</td><td>${prHdr('HY')}</td><td class="red">${num(mx('HY'))}</td><td>${num(tcols.reduce((n, c) => n + mx(c), 0) + mx('HY'))}</td><td>${thHdr('AN')}</td><td>${prHdr('AN')}</td><td class="red">${num(mx('AN'))}</td><td class="grn">${num(tcols.reduce((n, c) => n + mx(c), 0) + mx('HY') + mx('AN'))}</td><td>%</td></tr>
      ${main.map(row).join('')}
      <tr><td>Total Marks</td>${T.map((t) => `<td>${num(t)}</td>`).join('')}<td></td><td></td><td class="red">${num(tHy)}</td><td>${num(tHyt)}</td><td></td><td></td><td class="red">${num(tAn)}</td><td class="grn">${num(tSt)}</td><td></td></tr>
      <tr><td>Total Max Marks</td>${M.map((m) => `<td>${nz(m)}</td>`).join('')}<td></td><td></td><td class="red"></td><td>${nz(mHyt)}</td><td></td><td></td><td class="red">${nz(mAn)}</td><td class="grn">${nz(mSt)}</td><td></td></tr>
      <tr><td>Percentage</td>${T.map((t, i) => `<td>${P(t, M[i])}</td>`).join('')}<td></td><td></td><td class="red"></td><td>${P(tHyt, mHyt)}</td><td></td><td></td><td class="red">${P(tAn, mAn)}</td><td class="grn">${P(tSt, mSt)}</td><td></td></tr>
      <tr class="gap"><td colspan="13"></td></tr>
      ${extra.map(row).join('')}
      <tr><td>Jeevan Kaushal</td><td colspan="2">Based Evalution (30)</td><td>${num(j.based)}</td><td colspan="3">Assignment evalution (30)</td><td>${num(j.assignment)}</td><td colspan="2">Annual Exam (40)</td><td>${num(j.annual)}</td><td>${num(jT)}</td><td></td></tr>
      ${resultBlock(v, 13, [4, 3, 4, 2])}
    </table>`;
  } else {
    // English medium: Term-1 FA-1 FA-2 SA-1, Term-2 FA-3 FA-4 SA-2
    const t1c = ['FA1', 'FA2', 'SA1'];
    const t2c = ['FA3', 'FA4', 'SA2'];
    const tt = (x: MarksheetSubject, cs: string[]) => sum(cs.map((c) => x.cells[c]?.total));
    const ttMax = (x: MarksheetSubject, cs: string[]) => cs.reduce((n, c) => n + (x.cells[c]?.max ?? 0), 0);
    const grand = (x: MarksheetSubject) => sum([tt(x, t1c), tt(x, t2c)]);
    const gMax = (x: MarksheetSubject) => ttMax(x, t1c) + ttMax(x, t2c);
    const row = (x: MarksheetSubject) => {
      const g = grand(x);
      return `<tr><td class="l">${esc(x.name)}</td>${t1c.map((c) => `<td class="l">${cellVal(x.cells[c])}</td>`).join('')}<td class="l">${num(tt(x, t1c))}</td>${t2c.map((c) => `<td class="l">${cellVal(x.cells[c])}</td>`).join('')}<td class="l">${num(tt(x, t2c))}</td><td class="l">${num(g)}</td><td class="l">${g != null && gMax(x) ? v.grade((g / gMax(x)) * 100) : ''}</td></tr>`;
    };
    const tot = (cs: string[]) => sum(main.map((x) => tt(x, cs)));
    const totMax = (cs: string[]) => main.reduce((n, x) => n + ttMax(x, cs), 0);
    const colT = [...t1c, 'T1TOT', ...t2c, 'T2TOT'].map((c) => (c === 'T1TOT' ? tot(t1c) : c === 'T2TOT' ? tot(t2c) : colTotal(c)));
    const colM = [...t1c, 'T1TOT', ...t2c, 'T2TOT'].map((c) => (c === 'T1TOT' ? totMax(t1c) : c === 'T2TOT' ? totMax(t2c) : maxTotal(c)));
    const g = sum(main.map(grand));
    const gm = main.reduce((n, x) => n + gMax(x), 0);
    const cs = v.extras.coScholastic ?? {};
    const hl = v.extras.health ?? {};
    const AREAS: [keyof CoTerm, string][] = [
      ['work', 'Work Education (Pre Vocational Education)'],
      ['art', 'Art Education'],
      ['health', 'Health &amp; Physical Education'],
      ['discipline', 'Discipline'],
    ];
    table = `<table class="mk en">
      <tr class="gap"><td colspan="11"></td></tr>
      <tr><th>SCHOLASTIC AREAS</th><th colspan="3">TERM-1</th><th></th><th colspan="3">TERM-2</th><th></th><th rowspan="2">Grand Total</th><th></th></tr>
      <tr><th rowspan="2">Subject</th><th>FA-1</th><th>FA-2</th><th>SA-1</th><th>TOTAL</th><th>FA-3</th><th>FA-4</th><th>SA-2</th><th>TOTAL</th><th rowspan="2">Grade</th></tr>
      <tr>${t1c.map((c) => `<th>${num(mx(c))}</th>`).join('')}<th>${num(t1c.reduce((n, c) => n + mx(c), 0))}</th>${t2c.map((c) => `<th>${num(mx(c))}</th>`).join('')}<th>${num(t2c.reduce((n, c) => n + mx(c), 0))}</th><th>${num([...t1c, ...t2c].reduce((n, c) => n + mx(c), 0))}</th></tr>
      ${main.map(row).join('')}
      <tr><td class="l">Total</td>${colT.map((t) => `<td class="l">${num(t)}</td>`).join('')}<td class="l">${num(g)}</td><td></td></tr>
      <tr><td class="l">Percentage</td>${colT.map((t, i) => `<th>${P(t, colM[i])}</th>`).join('')}<th>${P(g, gm)}</th><td></td></tr>
      ${extra.map(row).join('')}
      <tr class="gap"><td colspan="11"></td></tr>
      <tr><td class="l" colspan="4">CO-SCHOLASTIC AREAS</td><td class="l">Grade</td><td class="l" colspan="5">CO-SCHOLASTIC AREAS</td><td class="l">Grade</td></tr>
      ${AREAS.map(([k, label]) => `<tr><td class="l" colspan="4">${label}</td><td class="l">${esc(cs.t1?.[k] ?? '')}</td><td class="l" colspan="5">${label}</td><td class="l">${esc(cs.t2?.[k] ?? '')}</td></tr>`).join('')}
      <tr class="gap"><td colspan="11"></td></tr>
      <tr><td colspan="5">Health Status</td><td colspan="6">Health Status</td></tr>
      <tr><td class="l" colspan="4">Height (In CM)</td><td class="l">${esc(hl.t1?.height ?? '')}</td><td class="l" colspan="5">Height (In CM)</td><td class="l">${esc(hl.t2?.height ?? '')}</td></tr>
      <tr><td class="l" colspan="4">Weight (In KG)</td><td class="l">${esc(hl.t1?.weight ?? '')}</td><td class="l" colspan="5">Weight (In KG)</td><td class="l">${esc(hl.t2?.weight ?? '')}</td></tr>
      <tr class="gap"><td colspan="11"></td></tr>
      <tr><th class="l" colspan="4">Remark : ${esc(v.extras.remark ?? '')}</th><th class="l" colspan="3">Result : ${esc(v.overall.result)}</th><th class="l" colspan="4">Rank : ${v.overall.rank ?? ''}</th></tr>
      <tr class="gap"><td colspan="11"></td></tr>
      <tr class="sgn"><td class="l" colspan="3">Sign of Class teacher</td><td class="l" colspan="4">Sign of Parent</td><td colspan="4">Principal</td></tr>
    </table>`;
  }

  return page(
    `@page{size:A4;margin:8mm}
    body{font-family:"Times New Roman",Times,serif;color:#00f}
    .sheet{border:1px solid #000;padding:10px 12px}
    table{width:100%;border-collapse:collapse}
    .hdr td{border:0;vertical-align:top} .hdr .lg{width:90px} .hdr img{width:80px;height:98px;object-fit:contain}
    .hdr .tt{text-align:center}
    .dep{color:green;font-size:12px;border-bottom:1px solid #ccc;padding:4px 0}
    .sch{font-family:Arial,Helvetica,sans-serif;font-size:19px;margin-top:4px;white-space:nowrap}
    .cmp{font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;border-bottom:1px solid #ccc;padding-bottom:4px}
    .prg{color:red;font-size:13px;margin-top:4px}
    .info td,.info th{border:1px solid #00f;padding:3px 6px;text-align:left;font-size:14px}
    .info .k{width:10%} .info .ph{width:18%;text-align:center} .info .ph img{width:70px;height:80px;object-fit:cover}
    .mk{margin-top:10px}
    .mk td,.mk th{border:1px solid #00f;padding:3px 4px;text-align:center;font-size:13.5px;font-weight:normal}
    .mk th{font-weight:bold}
    .mk.sm td,.mk.sm th{font-size:12.5px;padding:3px 2px}
    .mk .w{width:24%}
    .mk .l{text-align:left}
    .mk .red{color:red} .mk .grn{color:green} .mk .b{font-weight:bold}
    .mk .gap td{height:22px}
    .mk .res th{color:green;text-align:left}
    .mk .sg th{text-align:left} .mk .sg .pr{vertical-align:middle}
    .mk .mt{color:red;text-align:left}
    .mk.en td,.mk.en th{text-align:left} .mk.en th{text-align:center}
    .mk .sgn td{height:60px;vertical-align:bottom}`,
    `<div class="sheet">${header}${table}${below}</div>`,
  );
}

/** Result + attendance + signatures block shared by the secondary/senior layouts */
function resultBlock(v: MarksheetView, cols: number, spans: [number, number, number, number]) {
  const [a, b, c, d] = spans;
  const left = Math.ceil(cols / 2) + 1;
  const mid = Math.max(1, Math.floor(left / 2));
  return `
    <tr class="res"><th class="l" colspan="${a}">Result : ${esc(v.overall.result)}</th><th class="l" colspan="${b}">Division : ${esc(v.overall.division)}</th><th class="l" colspan="${c}">Declaration Date : ${esc(v.declarationDate)}</th><th class="l" colspan="${d}">Rank : ${v.overall.rank ?? ''}</th></tr>
    <tr><td class="mt" colspan="${mid}">Total Meetings</td><td class="l red" colspan="${left - mid}">${v.meetings ?? ''}</td><td colspan="${cols - left}" rowspan="5" class="pr">Principal</td></tr>
    <tr class="sg"><th colspan="${mid}">Student Attendence</th><td class="l" colspan="${left - mid}">${v.attended ?? ''}</td></tr>
    <tr class="sg"><th colspan="${mid}">Sign of Exam INCH</th><td colspan="${left - mid}"></td></tr>
    <tr class="sg"><th colspan="${mid}">Sign of Class teacher</th><td colspan="${left - mid}"></td></tr>
    <tr class="sg"><th colspan="${mid}">Sign of Parent</th><td colspan="${left - mid}"></td></tr>`;
}

// =====================================================================
// FEE DUE SLIP — given to students before a test/exam when fees are overdue
// =====================================================================
export interface DueSlipView {
  logo: string;
  print: PrintSettings;
  /** e.g. "अर्धवार्षिक परीक्षा"; empty when no exam is chosen */
  examPhrase: string;
  examDate: string;
  lastDate: string;
  slips: { name: string; female: boolean; father: string; className: string; amount: number }[];
}

export function dueSlipsHtml(v: DueSlipView) {
  const p = v.print;
  const slip = (s: DueSlipView['slips'][number]) => {
    const ch = s.female ? 'छात्रा' : 'छात्र';
    const who = `${ch} &nbsp;<b>${esc(s.name)}</b> , पिता &nbsp;<b>${esc(s.father)} ,</b> &nbsp; कक्षा - &nbsp;<b>${esc(s.className)}</b> &nbsp;`;
    const text = v.examPhrase
      ? `आपको सूचित किया जाता है की ${who} की ${esc(v.examPhrase)} दिनांक ${esc(v.examDate)} से शुरु हो रही है अतः कुल बकाया फीस ${num(s.amount)}, दिनाक ${esc(v.lastDate)} तक जमा कराकर प्रवेश पत्र प्राप्त कर लेवे ।`
      : `आपको सूचित किया जाता है की ${who} की कुल बकाया फीस ${num(s.amount)}, दिनाक ${esc(v.lastDate)} तक जमा कराना सुनिश्चित करें ।`;
    return `
    <div class="slip">
      <div class="head">
        ${v.logo ? `<img src="${v.logo}">` : '<span class="ph"></span>'}
        <div class="txt hi">
          <div class="sn">${esc(p.schoolNameHi)}</div>
          <div class="l1">${esc(p.addressHi)}, Mob. ${esc(p.phone)}</div>
          <div class="l2">विद्यालय का PSP कोड - ${esc(p.pspCode)}, DIC कोड - ${esc(p.dicCode)}, बोर्ड कोड - ${esc(p.boardCode)}</div>
        </div>
      </div>
      <div class="body hi">
        <p class="greet"><b>आदरणीय अभिभावक महोदय जी,</b></p>
        <p>${text}</p>
      </div>
      <div class="sign">Principal Signature</div>
    </div>`;
  };
  const pages: string[] = [];
  for (let i = 0; i < v.slips.length; i += 3) pages.push(`<div class="brk">${v.slips.slice(i, i + 3).map(slip).join('')}</div>`);
  return page(
    `@page{size:A4;margin:8mm}
    body{font-family:Arial,"Nirmala UI","Mangal",sans-serif;color:#111}
    .slip{border:1px solid #000;height:91mm;margin-bottom:3mm;padding:6px 14px;display:flex;flex-direction:column;overflow:hidden}
    .head{display:flex;align-items:center;border-bottom:1px solid #bfbfbf;padding-bottom:6px}
    .head img,.head .ph{width:60px;height:72px;object-fit:contain}
    .txt{flex:1;text-align:center;padding-right:60px}
    .sn{font-size:22px} .l1{font-size:11px;font-weight:bold;margin-top:4px} .l2{font-size:11px;margin-top:3px}
    .body{font-size:13.5px;line-height:1.6;padding:6px 4px 0}
    .body p{margin:6px 0} .greet{margin-top:10px!important}
    .body p:last-child{padding-left:10px}
    .sign{margin-top:auto;text-align:right;font-size:13px;padding-bottom:4px}`,
    pages.join('') || '<p style="font-family:sans-serif;padding:20px">No students with pending fees.</p>',
  );
}

// =====================================================================
// SINGLE TEST MARKSHEET — one exam (class test / unit test / half yearly …)
// =====================================================================
export interface TestMarksheetView {
  logo: string;
  photo: string;
  print: PrintSettings;
  campus: string;
  session: string;
  examName: string;
  student: { name: string; father: string; mother: string; className: string; rollNo: string; srNo: string };
  practical: boolean;
  rows: { subject: string; max: number; th: number | null; pr: number | null; thMax: number; prMax: number | null; total: number | null; absent: boolean; pass: number; additional: boolean }[];
  total: number;
  max: number;
  percent: number | null;
  grade: string;
  result: string;
  rank: number | null;
  classSize: number;
}

export function testMarksheetHtml(v: TestMarksheetView) {
  const p = v.print;
  const s = v.student;
  const main = v.rows.filter((r) => !r.additional);
  const extra = v.rows.filter((r) => r.additional);
  const mark = (x: number | null, absent: boolean) => (absent ? 'AB' : x == null ? '' : num(x));
  const line = (r: TestMarksheetView['rows'][number]) => {
    const low = !r.absent && r.total != null && r.total < r.pass;
    return `<tr><td class="l">${esc(r.subject)}</td>${v.practical ? `<td>${num(r.thMax)}</td><td>${r.prMax != null ? num(r.prMax) : '-'}</td>` : ''}<td>${num(r.max)}</td>${
      v.practical ? `<td>${mark(r.th, r.absent)}</td><td>${r.prMax != null ? mark(r.pr, r.absent) : '-'}</td>` : ''
    }<td class="${low || r.absent ? 'red' : ''}">${mark(r.total, r.absent)}</td></tr>`;
  };
  const cols = v.practical ? 6 : 3;
  return page(
    `@page{size:A4;margin:10mm}
    body{font-family:"Times New Roman",Times,serif;color:#00f}
    .sheet{border:1px solid #000;padding:12px 14px}
    table{width:100%;border-collapse:collapse}
    .hdr td{border:0;vertical-align:top} .hdr .lg{width:90px} .hdr img{width:80px;height:98px;object-fit:contain} .hdr .tt{text-align:center}
    .dep{color:green;font-size:12px;border-bottom:1px solid #ccc;padding:4px 0}
    .sch{font-family:Arial,Helvetica,sans-serif;font-size:19px;margin-top:4px;white-space:nowrap}
    .cmp{font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:bold;border-bottom:1px solid #ccc;padding-bottom:4px}
    .prg{color:red;font-size:13px;margin-top:4px}
    .info td,.info th{border:1px solid #00f;padding:4px 6px;text-align:left;font-size:14px}
    .info .ph{width:16%;text-align:center} .info .ph img{width:66px;height:76px;object-fit:cover}
    .mk{margin-top:12px} .mk td,.mk th{border:1px solid #00f;padding:5px 6px;text-align:center;font-size:14px}
    .mk .l{text-align:left} .mk .red{color:red} .mk .b td{font-weight:bold}
    .res th{color:green;text-align:left;border:1px solid #00f;padding:6px;font-size:14px}
    .sg td{border:1px solid #00f;height:56px;vertical-align:bottom;padding:4px 6px;font-size:13px;width:33%}`,
    `<div class="sheet">
      <table class="hdr"><tr>
        <td class="lg">${v.logo ? `<img src="${v.logo}">` : ''}</td>
        <td class="tt">
          <div class="dep">${esc(p.department)}</div>
          <div class="sch">${esc(p.schoolName)}</div>
          <div class="cmp">( UDISE CODE - ${esc(p.udiseCode)} ) ${esc(v.campus)} ${esc(p.phone)}</div>
          <div class="prg">${esc(v.examName.toUpperCase())} — PROGRESS REPORT ${esc(v.session)}</div>
        </td></tr></table>
      <table class="info">
        <tr><td>Student</td><td colspan="3">${esc(s.name)}</td><td rowspan="3" class="ph">${v.photo ? `<img src="${v.photo}">` : ''}</td></tr>
        <tr><td>Father / Mother</td><td colspan="3">${esc(s.father)}${s.mother ? ` / ${esc(s.mother)}` : ''}</td></tr>
        <tr><th>Class : ${esc(s.className)}</th><th>Roll No. : ${esc(s.rollNo)}</th><th colspan="2">Sr No. : ${esc(s.srNo)}</th></tr>
      </table>
      <table class="mk">
        <tr><th class="l">Subjects</th>${v.practical ? '<th>Max TH</th><th>Max PR</th>' : ''}<th>Max Marks</th>${v.practical ? '<th>TH</th><th>PR</th>' : ''}<th>Obtained</th></tr>
        ${main.map(line).join('')}
        <tr class="b"><td class="l">Total</td>${v.practical ? '<td></td><td></td>' : ''}<td>${num(v.max)}</td>${v.practical ? '<td></td><td></td>' : ''}<td>${num(v.total)}</td></tr>
        <tr class="b"><td class="l">Percentage</td><td colspan="${cols - 1}" style="text-align:right">${v.percent != null ? pct(v.percent) : ''}</td></tr>
        ${extra.length ? `<tr><td colspan="${cols}" style="height:14px;border-left:0;border-right:0"></td></tr>${extra.map(line).join('')}` : ''}
      </table>
      <table class="mk"><tr class="res"><th>Result : ${esc(v.result)}</th><th>Grade : ${esc(v.grade)}</th><th>Rank : ${v.rank ?? ''}${v.rank ? ` / ${v.classSize}` : ''}</th></tr></table>
      <table class="mk"><tr class="sg"><td>Sign of Class teacher</td><td>Sign of Parent</td><td style="text-align:right">Principal</td></tr></table>
    </div>`,
  );
}
