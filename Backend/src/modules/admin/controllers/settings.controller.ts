import { BadRequestException, Body, Controller, Get, Post, Put, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { CurrentUser, Permissions, SkipScope } from '../../../common/decorators';
import type { AuthUser } from '../../../common/interfaces/request-context';
import { FeeSettingsDto, GradesDto, PrintSettingsDto, SchoolProfileDto } from '../dto/settings.dto';
import { SettingsService } from '../services/settings.service';

const LOGO_DIR = join(process.cwd(), 'uploads', 'images', 'school');
mkdirSync(LOGO_DIR, { recursive: true });

@SkipScope()
@Controller('admin/settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** School name/logo is needed by every logged-in screen (header, prints) */
  @Get()
  all() {
    return this.settings.all();
  }

  @Put('school')
  @Permissions('settings.update')
  school(@Body() dto: SchoolProfileDto, @CurrentUser() u: AuthUser) {
    return this.settings.set('school', dto, u);
  }

  @Put('fees')
  @Permissions('settings.update')
  fees(@Body() dto: FeeSettingsDto, @CurrentUser() u: AuthUser) {
    return this.settings.set('fees', dto, u);
  }

  @Put('print')
  @Permissions('settings.update')
  print(@Body() dto: PrintSettingsDto, @CurrentUser() u: AuthUser) {
    return this.settings.set('print', dto, u);
  }

  @Put('grades')
  @Permissions('settings.update')
  grades(@Body() dto: GradesDto, @CurrentUser() u: AuthUser) {
    const sorted = [...dto.grades].sort((a, b) => b.min - a.min);
    if (sorted[sorted.length - 1].min !== 0) throw new BadRequestException('Lowest grade band must start at 0');
    return this.settings.set('grades', sorted, u);
  }

  @Post('logo')
  @Permissions('settings.update')
  @UseInterceptors(
    FileInterceptor('logo', {
      limits: { fileSize: 1024 * 1024, files: 1 },
      fileFilter: (_r, f, cb) =>
        ['image/png', 'image/jpeg'].includes(f.mimetype) ? cb(null, true) : cb(new BadRequestException('Logo must be PNG or JPG'), false),
      storage: diskStorage({
        destination: LOGO_DIR,
        filename: (_r, f, cb) => cb(null, `logo-${Date.now()}${extname(f.originalname).toLowerCase() || '.png'}`),
      }),
    }),
  )
  logo(@UploadedFile() file: Express.Multer.File, @CurrentUser() u: AuthUser) {
    if (!file) throw new BadRequestException('Logo file is required');
    return this.settings.set('school', { logoPath: `images/school/${file.filename}` }, u);
  }
}
