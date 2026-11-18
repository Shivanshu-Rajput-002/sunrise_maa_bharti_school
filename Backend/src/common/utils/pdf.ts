import { existsSync } from 'fs';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import type { SchoolProfile } from '../../modules/admin/services/settings.service';

export type Doc = PDFKit.PDFDocument;

/** Collects a pdfkit document into a Buffer */
export function renderPdf(build: (doc: Doc) => void, options: PDFKit.PDFDocumentOptions = {}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 36, ...options });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    try {
      build(doc);
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

/** School letterhead: logo + name + address. Returns the y position below it. */
export function letterhead(doc: Doc, school: SchoolProfile, x: number, y: number, width: number, opts: { compact?: boolean } = {}) {
  const logo = school.logoPath ? join(process.cwd(), 'uploads', school.logoPath) : null;
  const logoSize = opts.compact ? 40 : 56;
  if (logo && existsSync(logo)) {
    try {
      doc.image(logo, x, y, { fit: [logoSize, logoSize] });
    } catch {
      /* unreadable image — skip */
    }
  }
  const tx = x + logoSize + 10;
  const tw = width - logoSize - 10;
  doc.font('Helvetica-Bold').fontSize(opts.compact ? 13 : 17).fillColor('#1e293b').text(school.name.toUpperCase(), tx, y, { width: tw, align: 'center' });
  doc.font('Helvetica').fontSize(opts.compact ? 7.5 : 9).fillColor('#475569');
  if (school.tagline) doc.text(school.tagline, tx, doc.y + 1, { width: tw, align: 'center' });
  const line = [school.address, school.phone && `Ph: ${school.phone}`, school.email].filter(Boolean).join('  |  ');
  if (line) doc.text(line, tx, doc.y + 1, { width: tw, align: 'center' });
  if (school.affiliation) doc.text(school.affiliation, tx, doc.y + 1, { width: tw, align: 'center' });
  const bottom = Math.max(doc.y, y + logoSize) + 6;
  doc.moveTo(x, bottom).lineTo(x + width, bottom).lineWidth(1).strokeColor('#94a3b8').stroke();
  doc.fillColor('#1e293b');
  return bottom + 8;
}

export interface Column {
  header: string;
  width: number;
  align?: 'left' | 'center' | 'right';
}

/** Simple bordered table with automatic page breaks; repeats the header on new pages */
export function table(doc: Doc, x: number, y: number, columns: Column[], rows: (string | number)[][], opts: { rowHeight?: number; fontSize?: number } = {}) {
  const rowH = opts.rowHeight ?? 18;
  const fs = opts.fontSize ?? 9;
  const totalW = columns.reduce((n, c) => n + c.width, 0);
  const bottomLimit = doc.page.height - doc.page.margins.bottom - rowH;

  const drawRow = (cells: (string | number)[], yy: number, header = false) => {
    if (header) doc.rect(x, yy, totalW, rowH).fillColor('#e2e8f0').fill();
    doc.fillColor('#1e293b').font(header ? 'Helvetica-Bold' : 'Helvetica').fontSize(fs);
    let cx = x;
    columns.forEach((c, i) => {
      doc.text(String(cells[i] ?? ''), cx + 4, yy + (rowH - fs) / 2 - 1, { width: c.width - 8, align: c.align ?? 'left', lineBreak: false, ellipsis: true });
      cx += c.width;
    });
    doc.rect(x, yy, totalW, rowH).lineWidth(0.5).strokeColor('#94a3b8').stroke();
    cx = x;
    for (const c of columns.slice(0, -1)) {
      cx += c.width;
      doc.moveTo(cx, yy).lineTo(cx, yy + rowH).stroke();
    }
  };

  drawRow(columns.map((c) => c.header), y, true);
  y += rowH;
  for (const r of rows) {
    if (y > bottomLimit) {
      doc.addPage();
      y = doc.page.margins.top;
      drawRow(columns.map((c) => c.header), y, true);
      y += rowH;
    }
    drawRow(r, y);
    y += rowH;
  }
  return y;
}

/** Label: value pairs in a grid */
export function keyValues(doc: Doc, x: number, y: number, width: number, pairs: [string, string][], cols = 2, fontSize = 9.5) {
  const colW = width / cols;
  let maxY = y;
  pairs.forEach(([k, v], i) => {
    const cx = x + (i % cols) * colW;
    const cy = y + Math.floor(i / cols) * (fontSize + 8);
    doc.font('Helvetica-Bold').fontSize(fontSize).fillColor('#334155').text(`${k}:`, cx, cy, { continued: true });
    doc.font('Helvetica').fillColor('#0f172a').text(` ${v || '-'}`, { width: colW - 6, lineBreak: false, ellipsis: true });
    maxY = Math.max(maxY, cy + fontSize + 8);
  });
  return maxY;
}

export const fmtDate = (d?: string | Date | null) => {
  if (!d) return '-';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`;
};
