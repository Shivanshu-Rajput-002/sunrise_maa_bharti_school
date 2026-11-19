import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AuthUser } from '../../../common/interfaces/request-context';
import { Setting } from '../entities/setting.entity';
import { AuditService } from './audit.service';

export interface SchoolProfile {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  affiliation: string;
  principal: string;
  logoPath: string | null;
}

/** Text printed on the old-format documents (receipt, admit card, marksheet, certificates) */
export interface PrintSettings {
  schoolName: string; // marksheet / study certificate heading
  schoolNameHi: string;
  shortName: string; // receipt heading
  certName: string; // English certificate heading
  admitName: string; // admit card heading
  department: string;
  address: string; // full address line (receipts, certificates)
  addressHi: string;
  phone: string;
  udiseCode: string;
  pspCode: string;
  dicCode: string;
  boardCode: string;
  /** Campus line on marksheet / admit card, per medium code */
  campusHi: string;
  campusEn: string;
}

export interface FeeSettings {
  /** % off when a student clears ALL remaining dues in one receipt (0 = off) */
  fullPaymentDiscountPercent: number;
  /** Flat late fee per overdue installment (0 = off) */
  lateFeePerInstallment: number;
  receiptPrefix: string;
}

export interface GradeBand {
  min: number;
  grade: string;
}

const DEFAULTS = {
  school: {
    name: 'Sunrise Maa Bharti School',
    tagline: '',
    address: '',
    phone: '',
    email: '',
    affiliation: '',
    principal: '',
    logoPath: null,
  } as SchoolProfile,
  print: {
    schoolName: 'SUNRISE MAA BHARTI SENIOR SECONDARY SCHOOL BIJOLIYA',
    schoolNameHi: 'सनराईज माँ भारती सीनियर सेकेंडरी स्कूल बिजौलिया',
    shortName: 'Sunrise Maa Bharti School.',
    certName: 'Sunrise Maa Bharti Senior Secondary School.',
    admitName: 'MAA BHARTI SENIOR SECONDARY SCHOOL BIJOLIYA',
    department: 'DEPARTMENT OF EDUCATION, RAJASTHAN',
    address: 'Near Moti Bavji, Bijoliya District- Bhilwara',
    addressHi: 'मोती बावजी के पास, बिजौलिया जिला - भीलवाड़ा',
    phone: '9783762326',
    udiseCode: '08241208725',
    pspCode: 'P27635',
    dicCode: '08241208725',
    boardCode: '1060678',
    campusHi: 'MOTI BAVJI KE PASS BIJOLIYA',
    campusEn: 'SABJI MANDI KE PASS BIJOLIYA',
  } as PrintSettings,
  /** Staff attendance: arriving after this time (HH:MM) counts as late */
  staff: { lateAfter: '08:00' },
  fees: { fullPaymentDiscountPercent: 10, lateFeePerInstallment: 0, receiptPrefix: 'R' } as FeeSettings,
  // Same bands as the old marksheet (GetGrade)
  grades: [
    { min: 91, grade: 'A+' },
    { min: 76, grade: 'A' },
    { min: 61, grade: 'B' },
    { min: 41, grade: 'C' },
    { min: 0, grade: 'D' },
  ] as GradeBand[],
};
type Key = keyof typeof DEFAULTS;

/** Key/value settings with defaults, cached in memory */
@Injectable()
export class SettingsService {
  private cache = new Map<string, unknown>();

  constructor(
    @InjectModel(Setting) private readonly settings: typeof Setting,
    private readonly audit: AuditService,
  ) {}

  async get<K extends Key>(key: K): Promise<(typeof DEFAULTS)[K]> {
    if (!this.cache.has(key)) {
      const row = await this.settings.findByPk(key);
      const value = Array.isArray(DEFAULTS[key])
        ? ((row?.value as unknown[]) ?? DEFAULTS[key])
        : { ...(DEFAULTS[key] as object), ...((row?.value as object) ?? {}) };
      this.cache.set(key, value);
    }
    return this.cache.get(key) as (typeof DEFAULTS)[K];
  }

  async all() {
    const [school, fees, grades, print] = await Promise.all([this.get('school'), this.get('fees'), this.get('grades'), this.get('print')]);
    return { school, fees, grades, print };
  }

  async set<K extends Key>(key: K, value: Partial<(typeof DEFAULTS)[K]> | GradeBand[], actor?: AuthUser) {
    const merged = Array.isArray(DEFAULTS[key]) ? value : { ...(await this.get(key)), ...value };
    await this.settings.upsert({ key, value: merged });
    this.cache.set(key, merged);
    if (actor) this.audit.log({ userId: actor.id, action: 'update', entity: 'settings', entityId: key });
    return merged;
  }
}
