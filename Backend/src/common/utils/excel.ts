import ExcelJS from 'exceljs';

export interface SheetColumn {
  header: string;
  key: string;
  width?: number;
  numFmt?: string;
}

/** One-sheet workbook with a bold, frozen header row and optional title lines above it */
export async function buildSheet(name: string, columns: SheetColumn[], rows: Record<string, unknown>[], title?: string[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sunrise ERP';
  const ws = wb.addWorksheet(name.slice(0, 31));
  let headerRowNo = 1;
  if (title?.length) {
    title.forEach((t, i) => {
      const r = ws.getRow(i + 1);
      r.getCell(1).value = t;
      r.font = { bold: i === 0, size: i === 0 ? 13 : 10 };
    });
    headerRowNo = title.length + 2;
  }
  const header = ws.getRow(headerRowNo);
  columns.forEach((c, i) => {
    header.getCell(i + 1).value = c.header;
    ws.getColumn(i + 1).width = c.width ?? Math.max(10, c.header.length + 2);
    if (c.numFmt) ws.getColumn(i + 1).numFmt = c.numFmt;
  });
  header.font = { bold: true };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  rows.forEach((r) => ws.addRow(columns.map((c) => r[c.key] ?? '')));
  ws.views = [{ state: 'frozen', ySplit: headerRowNo }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export const MONEY_FMT = '#,##0.00';
