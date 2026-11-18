import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { existsSync } from 'fs';
import { join } from 'path';
import { Op, UniqueConstraintError, WhereOptions } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { PARENT_ROLE } from '../../../common/constants';
import { AuthUser, RequestScope } from '../../../common/interfaces/request-context';
import { hashPassword } from '../../../common/utils/password';
import { HtmlPdfService } from '../../../common/pdf/html-pdf.service';
import { certificateHtml, dmy } from '../../../common/pdf/print-templates';
import { fmtDate, letterhead, renderPdf } from '../../../common/utils/pdf';
import { SequenceService } from '../../../database/sequence.service';
import { AcademicSession } from '../../academic/entities/academic-session.entity';
import { Medium } from '../../academic/entities/medium.entity';
import { SchoolClass } from '../../academic/entities/school-class.entity';
import { Section } from '../../academic/entities/section.entity';
import { Role } from '../../admin/entities/role.entity';
import { User } from '../../admin/entities/user.entity';
import { AuditService } from '../../admin/services/audit.service';
import { SettingsService } from '../../admin/services/settings.service';
import { CertificateRegisterQueryDto, IdCardQueryDto, IssueCertificateDto, LinkParentDto } from '../dto/documents.dto';
import { Certificate, CertificateType } from '../entities/certificate.entity';
import { StudentEnrollment } from '../entities/student-enrollment.entity';
import { Student } from '../entities/student.entity';

const PREFIX: Record<CertificateType, string> = { character: 'CC', study: 'SC', transfer: 'TC' };
const TITLE: Record<CertificateType, string> = { character: 'CHARACTER CERTIFICATE', study: 'STUDY / BONAFIDE CERTIFICATE', transfer: 'TRANSFER CERTIFICATE' };

@Injectable()
export class StudentDocumentsService {
  constructor(
    @InjectModel(Student) private readonly students: typeof Student,
    @InjectModel(StudentEnrollment) private readonly enrollments: typeof StudentEnrollment,
    @InjectModel(Certificate) private readonly certificates: typeof Certificate,
    @InjectModel(AcademicSession) private readonly sessions: typeof AcademicSession,
    @InjectModel(User) private readonly users: typeof User,
    @InjectModel(Role) private readonly roles: typeof Role,
    private readonly settings: SettingsService,
    private readonly sequences: SequenceService,
    private readonly audit: AuditService,
    private readonly sequelize: Sequelize,
    private readonly pdf: HtmlPdfService,
  ) {}

  // ---------- certificates ----------
  listCertificates(studentId: number) {
    return this.certificates.findAll({
      where: { studentId },
      include: [{ model: User, as: 'issuer', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
    });
  }

  /** Students of a class with their latest certificate of one type in this session */
  async certificateRegister(q: CertificateRegisterQueryDto, scope: RequestScope) {
    const where: WhereOptions = { sessionId: scope.sessionId, classId: q.classId };
    if (q.sectionId) Object.assign(where, { sectionId: q.sectionId });
    const m = q.mediumId ?? scope.mediumId;
    if (m) Object.assign(where, { mediumId: m });
    // TC list keeps students who already left (their TC was issued); others show current students
    if (q.type !== 'transfer') Object.assign(where, { status: { [Op.ne]: 'left' } });
    const enrs = await this.enrollments.findAll({
      where,
      attributes: ['id', 'studentId', 'rollNo', 'status'],
      include: [
        { model: Student, required: true, attributes: ['id', 'name', 'admissionNo', 'fatherName', 'status'] },
        { model: SchoolClass, attributes: ['name'] },
        { model: Section, attributes: ['name'] },
        { model: Medium, attributes: ['name'] },
      ],
      order: [['rollNo', 'ASC'], [{ model: Student, as: 'student' }, 'name', 'ASC']],
    });
    const certs = enrs.length
      ? await this.certificates.findAll({
          where: { type: q.type, sessionId: scope.sessionId, studentId: enrs.map((e) => e.studentId) },
          attributes: ['id', 'studentId', 'serialNo', 'issuedOn'],
          order: [['id', 'DESC']],
        })
      : [];
    const latest = new Map<number, Certificate>();
    for (const c of certs) if (!latest.has(c.studentId)) latest.set(c.studentId, c);
    return enrs.map((e) => ({
      enrollmentId: e.id,
      studentId: e.studentId,
      rollNo: e.rollNo,
      name: e.student?.name,
      admissionNo: e.student?.admissionNo,
      fatherName: e.student?.fatherName,
      studentStatus: e.student?.status,
      className: `${e.schoolClass?.name ?? ''}${e.section ? '-' + e.section.name : ''}`,
      medium: e.medium?.name,
      certificate: latest.get(e.studentId) ?? null,
    }));
  }

  async issue(studentId: number, dto: IssueCertificateDto, scope: RequestScope, actor: AuthUser) {
    const [student, enr, session] = await Promise.all([
      this.students.findByPk(studentId),
      this.enrollments.findOne({
        where: { studentId, sessionId: scope.sessionId },
        include: [{ model: SchoolClass, attributes: ['name'] }, { model: Section, attributes: ['name'] }, { model: Medium, attributes: ['name', 'code'] }],
      }),
      this.sessions.findByPk(scope.sessionId),
    ]);
    if (!student) throw new NotFoundException('Student not found');
    if (!enr) throw new BadRequestException('Student is not enrolled in the selected session');
    if (dto.type === 'transfer' && student.status === 'tc_issued') throw new BadRequestException(`TC already issued (${student.tcNo})`);

    const issuedOn = dto.issuedOn ?? new Date().toISOString().slice(0, 10);
    const cert = await this.sequelize.transaction(async (t) => {
      const year = issuedOn.slice(0, 4);
      const n = await this.sequences.next(`cert:${dto.type}:${year}`, t);
      const serialNo = `${PREFIX[dto.type]}/${year}/${String(n).padStart(4, '0')}`;
      const data = {
        name: student.name,
        gender: student.gender,
        fatherName: student.fatherName,
        motherName: student.motherName,
        dob: student.dob,
        admissionNo: student.admissionNo,
        admissionDate: student.admissionDate,
        category: student.category,
        className: `${enr.schoolClass?.name ?? ''}${enr.section ? '-' + enr.section.name : ''}`,
        medium: enr.medium?.name,
        mediumCode: enr.medium?.code,
        address: student.address,
        session: session?.name,
        conduct: dto.conduct || 'Good',
        remarks: dto.remarks ?? null,
        leavingDate: dto.type === 'transfer' ? (dto.leavingDate ?? issuedOn) : null,
        leavingReason: dto.type === 'transfer' ? (dto.leavingReason ?? "Parent's request") : null,
      };
      const c = await this.certificates.create({ studentId, sessionId: scope.sessionId, type: dto.type, serialNo, issuedOn, data, issuedBy: actor.id }, { transaction: t });
      if (dto.type === 'transfer') {
        await student.update({ status: 'tc_issued', tcNo: serialNo, leavingDate: data.leavingDate, leavingReason: data.leavingReason }, { transaction: t });
        await enr.update({ status: 'left' }, { transaction: t });
      }
      return c;
    });
    this.audit.log({ userId: actor.id, sessionId: scope.sessionId, action: 'issue', entity: 'certificate', entityId: cert.id, meta: { type: dto.type, serialNo: cert.serialNo } });
    return cert;
  }

  async certificatePdf(certId: number) {
    const [c, school, print] = await Promise.all([this.certificates.findByPk(certId), this.settings.get('school'), this.settings.get('print')]);
    if (!c) throw new NotFoundException('Certificate not found');
    const d = c.data as Record<string, string | null>;

    // Character / study: the old school format (Hindi medium → Hindi text)
    if (c.type !== 'transfer') {
      const st = await this.students.findByPk(c.studentId, { attributes: ['photoPath', 'address', 'penNo', 'apaarId'] });
      const cls = String(d.className ?? '').replace(/^(\d+)-/, '$1');
      return this.pdf.render(
        certificateHtml({
          type: c.type,
          hindi: (d.mediumCode ?? (d.medium === 'Hindi' ? 'hi' : 'en')) === 'hi',
          logo: (school.logoPath && this.pdf.upload(school.logoPath, true)) || this.pdf.dataUri(join(process.cwd(), 'assets', 'default-logo.jpg'), true),
          photo: this.pdf.upload(st?.photoPath),
          print,
          serialNo: c.serialNo,
          issuedOn: dmy(c.issuedOn),
          name: d.name ?? '',
          female: d.gender === 'female',
          father: d.fatherName ?? '',
          mother: d.motherName ?? '',
          address: d.address ?? st?.address ?? '',
          dob: dmy(d.dob),
          srNo: d.admissionNo ?? '',
          className: cls,
          session: d.session ?? '',
          nicId: st?.penNo ?? st?.apaarId ?? '',
        }),
      );
    }
    const rel = d.gender === 'female' ? 'D/o' : 'S/o';
    const pron = d.gender === 'female' ? 'She' : 'He';
    const pos = d.gender === 'female' ? 'her' : 'his';

    return renderPdf((doc) => {
      const W = doc.page.width - 72;
      doc.rect(24, 24, doc.page.width - 48, doc.page.height - 48).lineWidth(2).strokeColor('#334155').stroke();
      doc.rect(30, 30, doc.page.width - 60, doc.page.height - 60).lineWidth(0.5).stroke();
      let y = letterhead(doc, school, 46, 46, W - 20);
      doc.font('Helvetica').fontSize(9.5).fillColor('#334155');
      doc.text(`Sr. No.: ${c.serialNo}`, 46, y);
      doc.text(`Date: ${fmtDate(c.issuedOn)}`, 46, y, { width: W - 20, align: 'right' });
      y += 30;
      doc.font('Helvetica-Bold').fontSize(18).fillColor('#0f172a').text(TITLE[c.type], 46, y, { width: W - 20, align: 'center', underline: true });
      y += 50;
      doc.font('Helvetica').fontSize(12).fillColor('#0f172a');
      const p = { width: W - 40, align: 'justify' as const, lineGap: 6 };

      if (c.type === 'character') {
        doc.text(
          `This is to certify that ${d.name}, ${rel} ${d.fatherName ?? '-'}, Admission No. ${d.admissionNo}, was a student of this school in class ${d.className} (${d.medium} medium) during the academic session ${d.session}. ${pron} bears a ${String(d.conduct).toLowerCase()} moral character. To the best of my knowledge, ${pos} conduct and behaviour during this period have been satisfactory.`,
          56, y, p,
        );
        doc.moveDown().text(`We wish ${pos === 'her' ? 'her' : 'him'} every success in life.`, p);
      } else if (c.type === 'study') {
        doc.text(
          `This is to certify that ${d.name}, ${rel} ${d.fatherName ?? '-'} and ${d.motherName ?? '-'}, Admission No. ${d.admissionNo}, is a bonafide student of this school, studying in class ${d.className} (${d.medium} medium) in the academic session ${d.session}. As per school records, ${pos} date of birth is ${fmtDate(d.dob)}.`,
          56, y, p,
        );
        doc.moveDown().text('This certificate is issued on request for official purposes.', p);
      } else {
        const rows: [string, string][] = [
          ['Name of student', d.name ?? '-'],
          ["Father's name", d.fatherName ?? '-'],
          ["Mother's name", d.motherName ?? '-'],
          ['Date of birth', fmtDate(d.dob)],
          ['Category', d.category ?? '-'],
          ['Admission No. / Date', `${d.admissionNo} / ${fmtDate(d.admissionDate)}`],
          ['Class last studied', `${d.className} (${d.medium} medium), Session ${d.session}`],
          ['Date of leaving', fmtDate(d.leavingDate)],
          ['Reason for leaving', d.leavingReason ?? '-'],
          ['General conduct', d.conduct ?? 'Good'],
          ['Remarks', d.remarks ?? '-'],
        ];
        rows.forEach(([k, v], i) => {
          const yy = y + i * 24;
          doc.font('Helvetica').fontSize(11).fillColor('#334155').text(`${i + 1}. ${k}`, 56, yy, { width: 200 });
          doc.font('Helvetica-Bold').fillColor('#0f172a').text(`: ${v}`, 260, yy, { width: W - 230 });
        });
      }
      if (c.data && (c.data as { remarks?: string }).remarks && c.type !== 'transfer') {
        doc.moveDown().font('Helvetica-Oblique').fontSize(10).text(`Remarks: ${(c.data as { remarks?: string }).remarks}`, p);
      }
      const bottom = doc.page.height - 130;
      doc.font('Helvetica').fontSize(10).fillColor('#334155').text('Checked by', 56, bottom);
      const principalName = school.principal && school.principal.trim().toLowerCase() !== 'principal' ? `\n${school.principal}` : '';
      doc.font('Helvetica-Bold').text(`Principal${principalName}`, 46, bottom, { width: W - 30, align: 'right' });
      doc.font('Helvetica').fontSize(9).text(school.name, 46, bottom + 28, { width: W - 30, align: 'right' });
    });
  }

  // ---------- ID cards ----------
  async idCardsPdf(q: IdCardQueryDto, scope: RequestScope) {
    const where: WhereOptions = { sessionId: scope.sessionId, status: { [Op.ne]: 'left' } };
    if (q.studentIds?.length) Object.assign(where, { studentId: q.studentIds });
    else {
      if (!q.classId) throw new BadRequestException('Choose a class or students');
      Object.assign(where, { classId: q.classId });
      if (q.sectionId) Object.assign(where, { sectionId: q.sectionId });
      const m = q.mediumId ?? scope.mediumId;
      if (m) Object.assign(where, { mediumId: m });
    }
    const [enrs, school, session] = await Promise.all([
      this.enrollments.findAll({
        where,
        include: [
          { model: Student, required: true },
          { model: SchoolClass, attributes: ['name'] },
          { model: Section, attributes: ['name'] },
          { model: Medium, attributes: ['name'] },
        ],
        order: [['rollNo', 'ASC'], [{ model: Student, as: 'student' }, 'name', 'ASC']],
      }),
      this.settings.get('school'),
      this.sessions.findByPk(scope.sessionId),
    ]);
    if (!enrs.length) throw new BadRequestException('No students found');

    // CR80-ish cards, 2 × 4 per A4
    const CW = 255;
    const CH = 165;
    const gapX = 20;
    const gapY = 14;
    return renderPdf((doc) => {
      const startX = (doc.page.width - (CW * 2 + gapX)) / 2;
      enrs.forEach((e, i) => {
        if (i > 0 && i % 8 === 0) doc.addPage();
        const slot = i % 8;
        const x = startX + (slot % 2) * (CW + gapX);
        const y = 40 + Math.floor(slot / 2) * (CH + gapY);
        const s = e.student!;
        doc.roundedRect(x, y, CW, CH, 8).lineWidth(0.8).strokeColor('#475569').stroke();
        doc.save().roundedRect(x, y, CW, 34, 8).clip().rect(x, y, CW, 34).fillColor('#4f46e5').fill().restore();
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff').text(school.name.toUpperCase(), x + 8, y + 7, { width: CW - 16, align: 'center', lineBreak: false, ellipsis: true });
        doc.font('Helvetica').fontSize(7).text(`IDENTITY CARD · SESSION ${session?.name ?? ''}`, x + 8, y + 21, { width: CW - 16, align: 'center' });

        const photo = s.photoPath ? join(process.cwd(), 'uploads', s.photoPath) : null;
        const px = x + 10;
        const py = y + 44;
        if (photo && existsSync(photo)) {
          try {
            doc.image(photo, px, py, { fit: [64, 78], align: 'center', valign: 'center' });
          } catch {
            /* ignore unreadable photo */
          }
        }
        doc.rect(px, py, 64, 78).lineWidth(0.5).strokeColor('#94a3b8').stroke();

        const tx = x + 84;
        const lines: [string, string][] = [
          ['Name', s.name],
          ['Class', `${e.schoolClass?.name ?? ''}${e.section ? '-' + e.section.name : ''} (${e.medium?.name ?? ''})`],
          ['Adm. No.', s.admissionNo],
          ['Father', s.fatherName ?? '-'],
          ['DOB', fmtDate(s.dob)],
          ['Mobile', s.fatherMobile ?? '-'],
        ];
        lines.forEach(([k, v], j) => {
          doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#334155').text(`${k}:`, tx, py + j * 13, { width: 44 });
          doc.font('Helvetica').fillColor('#0f172a').text(v, tx + 44, py + j * 13, { width: CW - 84 - 54, lineBreak: false, ellipsis: true });
        });
        doc.font('Helvetica').fontSize(6.5).fillColor('#475569').text([s.address, s.city].filter(Boolean).join(', ') || ' ', x + 10, y + CH - 22, { width: CW - 90, lineBreak: false, ellipsis: true });
        doc.font('Helvetica-Bold').fontSize(7).fillColor('#0f172a').text('Principal', x + CW - 70, y + CH - 18, { width: 60, align: 'center' });
      });
    });
  }

  // ---------- parent login ----------
  async linkParent(studentId: number, dto: LinkParentDto, actor: AuthUser) {
    const student = await this.students.findByPk(studentId);
    if (!student) throw new NotFoundException('Student not found');
    const parentRole = await this.roles.findOne({ where: { slug: PARENT_ROLE } });
    if (!parentRole) throw new BadRequestException('Parent role is missing');

    let userId = dto.userId;
    if (userId) {
      const u = await this.users.findByPk(userId);
      if (!u || u.roleId !== parentRole.id) throw new BadRequestException('Selected account is not a parent account');
    } else {
      if (!dto.username || !dto.password) throw new BadRequestException('Username and password are required for a new parent login');
      try {
        const u = await this.users.create({
          name: dto.name || student.fatherName || `Parent of ${student.name}`,
          username: dto.username,
          mobile: dto.mobile ?? student.fatherMobile,
          passwordHash: await hashPassword(dto.password),
          roleId: parentRole.id,
        });
        userId = u.id;
      } catch (e) {
        if (e instanceof UniqueConstraintError) throw new ConflictException('Username already exists');
        throw e;
      }
    }
    await student.update({ parentUserId: userId });
    this.audit.log({ userId: actor.id, action: 'link_parent', entity: 'student', entityId: studentId, meta: { parentUserId: userId } });
    return { studentId, parentUserId: userId };
  }

  async unlinkParent(studentId: number, actor: AuthUser) {
    const student = await this.students.findByPk(studentId);
    if (!student) throw new NotFoundException('Student not found');
    await student.update({ parentUserId: null });
    this.audit.log({ userId: actor.id, action: 'unlink_parent', entity: 'student', entityId: studentId });
    return { studentId };
  }

  /** Parent accounts for the "link existing" picker */
  async parentAccounts(search?: string) {
    const parentRole = await this.roles.findOne({ where: { slug: PARENT_ROLE } });
    if (!parentRole) return [];
    return this.users.findAll({
      where: {
        roleId: parentRole.id,
        ...(search ? { [Op.or]: [{ name: { [Op.like]: `%${search}%` } }, { username: { [Op.like]: `%${search}%` } }, { mobile: { [Op.like]: `%${search}%` } }] } : {}),
      },
      attributes: ['id', 'name', 'username', 'mobile'],
      limit: 20,
      order: [['name', 'ASC']],
    });
  }
}
