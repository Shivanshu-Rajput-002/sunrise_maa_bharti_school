import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { CurrentUser, Permissions, Scope } from '../../../common/decorators';
import type { AuthUser, RequestScope } from '../../../common/interfaces/request-context';
import { CertificateRegisterQueryDto, IdCardQueryDto, IssueCertificateDto, LinkParentDto } from '../dto/documents.dto';
import { AssignRollsDto, CreateStudentDto, PromoteDto, StudentQueryDto, UpdateStatusDto, UpdateStudentDto } from '../dto/student.dto';
import { StudentDocumentsService } from '../services/student-documents.service';
import { StudentImportService } from '../services/student-import.service';
import { StudentsService } from '../services/students.service';

const PHOTO_DIR = join(process.cwd(), 'uploads', 'images', 'students');
mkdirSync(PHOTO_DIR, { recursive: true });

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const sendPdf = (res: Response, pdf: Buffer, name: string) => {
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${name}"`, 'Cache-Control': 'no-store' });
  res.end(pdf);
};

@Controller('students')
export class StudentsController {
  constructor(
    private readonly students: StudentsService,
    private readonly documents: StudentDocumentsService,
    private readonly importer: StudentImportService,
  ) {}

  @Get()
  @Permissions('students.view')
  list(@Scope() scope: RequestScope, @Query() q: StudentQueryDto) {
    return this.students.list(scope, q);
  }

  @Get('stats')
  @Permissions('students.view')
  stats(@Scope() scope: RequestScope) {
    return this.students.stats(scope);
  }

  // ---------- import ----------
  @Get('import/template')
  @Permissions('students.import')
  async template(@Res() res: Response) {
    const buf = await this.importer.template();
    res.set({ 'Content-Type': XLSX, 'Content-Disposition': 'attachment; filename="students-import-template.xlsx"' });
    res.end(buf);
  }

  @Post('import')
  @Permissions('students.import')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_r, f, cb) => (f.mimetype === XLSX ? cb(null, true) : cb(new BadRequestException('Upload an .xlsx file'), false)),
    }),
  )
  import(@UploadedFile() file: Express.Multer.File, @Scope() scope: RequestScope, @CurrentUser() u: AuthUser) {
    if (!file) throw new BadRequestException('File is required');
    return this.importer.import(file.buffer, scope, u);
  }

  // ---------- documents ----------
  @Get('id-cards/pdf')
  @Permissions('students.certificates')
  async idCards(@Query() q: IdCardQueryDto, @Scope() scope: RequestScope, @Res() res: Response) {
    sendPdf(res, await this.documents.idCardsPdf(q, scope), 'id-cards.pdf');
  }

  @Get('certificates/register')
  @Permissions('students.certificates')
  certificateRegister(@Query() q: CertificateRegisterQueryDto, @Scope() scope: RequestScope) {
    return this.documents.certificateRegister(q, scope);
  }

  @Get('certificates/:certId/pdf')
  @Permissions('students.certificates')
  async certificatePdf(@Param('certId', ParseIntPipe) certId: number, @Res() res: Response) {
    sendPdf(res, await this.documents.certificatePdf(certId), `certificate-${certId}.pdf`);
  }

  @Get('parent-accounts')
  @Permissions('students.update')
  parentAccounts(@Query('search') search?: string) {
    return this.documents.parentAccounts(search?.slice(0, 50));
  }

  @Get(':id')
  @Permissions('students.view')
  get(@Param('id', ParseIntPipe) id: number, @Scope() scope: RequestScope) {
    return this.students.findOne(id, scope);
  }

  @Post()
  @Permissions('students.create')
  admit(@Body() dto: CreateStudentDto, @Scope() scope: RequestScope, @CurrentUser() u: AuthUser) {
    return this.students.admit(dto, scope, u);
  }

  @Patch(':id')
  @Permissions('students.update')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStudentDto, @Scope() scope: RequestScope, @CurrentUser() u: AuthUser) {
    return this.students.update(id, dto, scope, u);
  }

  @Patch(':id/status')
  @Permissions('students.update')
  status(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStatusDto, @Scope() scope: RequestScope, @CurrentUser() u: AuthUser) {
    return this.students.updateStatus(id, dto, scope, u);
  }

  @Delete(':id')
  @Permissions('students.delete')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.students.remove(id, u);
  }

  @Post('roll-numbers')
  @Permissions('students.update')
  assignRolls(@Body() dto: AssignRollsDto, @Scope() scope: RequestScope, @CurrentUser() u: AuthUser) {
    return this.students.assignRolls(dto, scope, u);
  }

  @Post('promote')
  @Permissions('students.promote')
  promote(@Body() dto: PromoteDto, @Scope() scope: RequestScope, @CurrentUser() u: AuthUser) {
    return this.students.promote(dto, scope, u);
  }

  @Get(':id/certificates')
  @Permissions('students.view')
  certificates(@Param('id', ParseIntPipe) id: number) {
    return this.documents.listCertificates(id);
  }

  @Post(':id/certificates')
  @Permissions('students.certificates')
  issue(@Param('id', ParseIntPipe) id: number, @Body() dto: IssueCertificateDto, @Scope() scope: RequestScope, @CurrentUser() u: AuthUser) {
    return this.documents.issue(id, dto, scope, u);
  }

  @Put(':id/parent')
  @Permissions('students.update')
  linkParent(@Param('id', ParseIntPipe) id: number, @Body() dto: LinkParentDto, @CurrentUser() u: AuthUser) {
    return this.documents.linkParent(id, dto, u);
  }

  @Delete(':id/parent')
  @Permissions('students.update')
  unlinkParent(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.documents.unlinkParent(id, u);
  }

  @Post(':id/photo')
  @Permissions('students.update')
  @UseInterceptors(
    FileInterceptor('photo', {
      limits: { fileSize: 2 * 1024 * 1024, files: 1 },
      fileFilter: (_req, file, cb) =>
        ALLOWED.has(file.mimetype) ? cb(null, true) : cb(new BadRequestException('Only JPG, PNG or WEBP images'), false),
      storage: diskStorage({
        destination: PHOTO_DIR,
        filename: (req, file, cb) =>
          cb(null, `${req.params.id}-${Date.now()}${extname(file.originalname).toLowerCase() || '.jpg'}`),
      }),
    }),
  )
  photo(@Param('id', ParseIntPipe) id: number, @UploadedFile() file: Express.Multer.File, @CurrentUser() u: AuthUser) {
    if (!file) throw new BadRequestException('Photo file is required');
    return this.students.setPhoto(id, file, u);
  }
}
