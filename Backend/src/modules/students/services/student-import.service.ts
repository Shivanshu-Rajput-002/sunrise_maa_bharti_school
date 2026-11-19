import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import ExcelJS from 'exceljs';
import { AuthUser, RequestScope } from '../../../common/interfaces/request-context';
import { Medium } from '../../academic/entities/medium.entity';
import { SchoolClass } from '../../academic/entities/school-class.entity';
import { Section } from '../../academic/entities/section.entity';
import { validationMessages } from '../../../common/errors/friendly-validation';
import { CreateStudentDto } from '../dto/student.dto';
import { StudentsService } from './students.service';

/** Column order of the template — the import reads by header name, so order is not critical */
const COLUMNS = [
  { header: 'Name*', key: 'name', width: 24 },
  { header: 'Gender*', key: 'gender', width: 10 },
  { header: 'Class*', key: 'class', width: 12 },
  { header: 'Section', key: 'section', width: 9 },
  { header: 'Medium*', key: 'medium', width: 10 },
  { header: 'Admission Date*', key: 'admissionDate', width: 16 },
  { header: 'Admission No', key: 'admissionNo', width: 14 },
  { header: 'Roll No', key: 'rollNo', width: 8 },
  { header: 'DOB', key: 'dob', width: 12 },
  { header: 'Category', key: 'category', width: 10 },
  { header: 'Religion', key: 'religion', width: 10 },
  { header: 'Father Name', key: 'fatherName', width: 20 },
  { header: 'Mother Name', key: 'motherName', width: 20 },
  { header: 'Father Mobile', key: 'fatherMobile', width: 13 },
  { header: 'Mother Mobile', key: 'motherMobile', width: 13 },
  { header: 'Aadhar No', key: 'aadharNo', width: 14 },
  { header: 'Address', key: 'address', width: 28 },
  { header: 'City', key: 'city', width: 12 },
  { header: 'Pincode', key: 'pincode', width: 9 },
];

const cellToString = (v: ExcelJS.CellValue): string => {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object' && 'text' in v) return String(v.text ?? '').trim();
  if (typeof v === 'object' && 'result' in v) return String(v.result ?? '').trim();
  return String(v).trim();
};

/** dd-mm-yyyy or dd/mm/yyyy → yyyy-mm-dd */
const normDate = (s: string) => {
  const m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : s;
};

@Injectable()
export class StudentImportService {
  constructor(
    @InjectModel(SchoolClass) private readonly classes: typeof SchoolClass,
    @InjectModel(Section) private readonly sections: typeof Section,
    @InjectModel(Medium) private readonly mediums: typeof Medium,
    private readonly students: StudentsService,
  ) {}

  async template(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Students');
    ws.columns = COLUMNS;
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    // The example lives on the Help sheet so it can never be imported by mistake
    const help = wb.addWorksheet('Help');
    help.addRows([
      ['Example row (copy the format into the Students sheet):'],
      COLUMNS.map((c) => c.header),
      ['Aarav Sharma', 'male', '1', 'A', 'Hindi', '2026-04-05', '', '', '2019-06-12', 'OBC', 'Hindu', 'Ramesh Sharma', 'Sunita Sharma', '9876543210', '', '', 'Ward 5', 'Kota', '324001'],
      [],
      ['Required columns are marked with *'],
      ['Gender: male / female / other'],
      ['Medium: Hindi / English (or hi / en)'],
      ['Class / Section: exactly as in Academic → Classes'],
      ['Dates: YYYY-MM-DD or DD-MM-YYYY'],
      ['Category: GEN, OBC, SC, ST, SBC, EWS'],
      ['Leave Admission No empty to auto-generate'],
    ]);
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  /** Each row is admitted on its own — one bad row never blocks the others */
  async import(buffer: Buffer, scope: RequestScope, actor: AuthUser) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    if (!ws) throw new BadRequestException('The file has no sheet');

    // Map headers → keys (tolerant of order, case and the * marker)
    const headerRow = ws.getRow(1);
    const keyByCol = new Map<number, string>();
    headerRow.eachCell((cell, col) => {
      const h = cellToString(cell.value).replace('*', '').trim().toLowerCase();
      const def = COLUMNS.find((c) => c.header.replace('*', '').toLowerCase() === h);
      if (def) keyByCol.set(col, def.key);
    });
    for (const req of ['name', 'gender', 'class', 'medium', 'admissionDate']) {
      if (![...keyByCol.values()].includes(req)) throw new BadRequestException(`Missing column: ${COLUMNS.find((c) => c.key === req)!.header}`);
    }
    if (ws.rowCount > 2001) throw new BadRequestException('Max 2000 students per file');

    const [classes, sections, mediums] = await Promise.all([
      this.classes.findAll({ attributes: ['id', 'name', 'nameHi'] }),
      this.sections.findAll({ attributes: ['id', 'classId', 'name'] }),
      this.mediums.findAll({ attributes: ['id', 'code', 'name'] }),
    ]);
    const classBy = (v: string) => classes.find((c) => c.name.toLowerCase() === v.toLowerCase() || c.nameHi?.toLowerCase() === v.toLowerCase());
    const mediumBy = (v: string) => mediums.find((m) => m.code === v.toLowerCase() || m.name.toLowerCase() === v.toLowerCase());

    const results: { row: number; status: 'ok' | 'error'; name?: string; admissionNo?: string; error?: string; className?: string; parentName?: string; username?: string; password?: string | null; loginNote?: string }[] = [];
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const raw: Record<string, string> = {};
      keyByCol.forEach((k, col) => (raw[k] = cellToString(row.getCell(col).value)));
      if (!Object.values(raw).some(Boolean)) continue;

      const cls = classBy(raw.class ?? '');
      const med = mediumBy(raw.medium ?? '');
      const sec = cls && raw.section ? sections.find((s) => s.classId === cls.id && s.name.toLowerCase() === raw.section.toLowerCase()) : undefined;
      if (!cls) {
        results.push({ row: r, status: 'error', name: raw.name, error: `Unknown class "${raw.class}"` });
        continue;
      }
      if (!med) {
        results.push({ row: r, status: 'error', name: raw.name, error: `Unknown medium "${raw.medium}"` });
        continue;
      }
      if (raw.section && !sec) {
        results.push({ row: r, status: 'error', name: raw.name, error: `Section "${raw.section}" not in class ${cls.name}` });
        continue;
      }

      const plain: Record<string, unknown> = {
        ...Object.fromEntries(Object.entries(raw).filter(([k, v]) => v !== '' && !['class', 'section', 'medium'].includes(k))),
        classId: cls.id,
        sectionId: sec?.id,
        mediumId: med.id,
        gender: (raw.gender || '').toLowerCase(),
        category: raw.category ? raw.category.toUpperCase() : undefined,
        admissionDate: normDate(raw.admissionDate),
        dob: raw.dob ? normDate(raw.dob) : undefined,
        rollNo: raw.rollNo ? Number(raw.rollNo) : undefined,
      };
      const dto = plainToInstance(CreateStudentDto, plain);
      const errs = await validate(dto, { whitelist: true });
      if (errs.length) {
        results.push({ row: r, status: 'error', name: raw.name, error: validationMessages(errs).join('; ') });
        continue;
      }
      try {
        const s = await this.students.admit(dto, scope, actor);
        const pl = s.parentLogin;
        results.push({
          row: r,
          status: 'ok',
          name: s.name,
          admissionNo: s.admissionNo,
          className: `${cls.name}${sec ? '-' + sec.name : ''}`,
          parentName: s.fatherName || s.motherName || '',
          username: pl?.username || undefined,
          password: pl?.password ?? null,
          loginNote: pl?.status === 'linked' ? 'Linked to family login' : pl?.status === 'skipped' ? pl.note : undefined,
        });
      } catch (e) {
        results.push({ row: r, status: 'error', name: raw.name, error: (e as Error).message });
      }
    }
    return {
      imported: results.filter((x) => x.status === 'ok').length,
      failed: results.filter((x) => x.status === 'error').length,
      results,
    };
  }
}
