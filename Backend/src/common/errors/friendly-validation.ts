import { BadRequestException, ValidationError } from '@nestjs/common';

/**
 * Turns class-validator output into short messages a school office user understands,
 * e.g. "sessionId must be an integer number" → "Session must be a whole number".
 */

/** Field names that read badly when auto-converted */
const LABELS: Record<string, string> = {
  sessionId: 'Session',
  mediumId: 'Medium',
  classId: 'Class',
  sectionId: 'Section',
  subjectId: 'Subject',
  studentId: 'Student',
  enrollmentId: 'Student',
  enrollmentIds: 'Students',
  examId: 'Exam',
  scheduleId: 'Exam subject',
  installmentId: 'Installment',
  feeHeadId: 'Fee head',
  routeId: 'Route',
  transportRouteId: 'Transport route',
  staffId: 'Staff',
  userId: 'Login account',
  roleId: 'Role',
  dob: 'Date of birth',
  admissionNo: 'Admission number',
  rollNo: 'Roll number',
  fatherMobile: "Father's mobile",
  motherMobile: "Mother's mobile",
  fatherName: "Father's name",
  motherName: "Mother's name",
  aadharNo: 'Aadhaar number',
  apiKey: 'Device key',
  biometricId: 'Biometric ID',
  gpsUrl: 'GPS link',
  busNo: 'Bus number',
  maxMarks: 'Maximum marks',
  passMarks: 'Pass marks',
  practicalMax: 'Practical maximum',
  practicalMarks: 'Practical marks',
  netAmount: 'Amount',
  paymentDate: 'Payment date',
  lastDate: 'Last date',
  txnDateTime: 'Punch time',
  punchId: 'Punch ID',
};

/** Nested fields (marksheet extras etc.) by full path */
const PATH_LABELS: Record<string, string> = {
  'supw.comp': 'SUPW compulsory activity',
  'supw.opt': 'SUPW optional activity',
  'supw.camp': 'SUPW camp',
  'art.theory': 'Art theory',
  'art.practical': 'Art practical',
  'art.assignment': 'Art assignment',
  'jeevan.based': 'Jeevan Kaushal based evaluation',
  'jeevan.assignment': 'Jeevan Kaushal assignment',
  'jeevan.annual': 'Jeevan Kaushal annual exam',
};

/** "admissionDate" → "Admission date", "supw.comp" → "SUPW compulsory activity" */
export function fieldLabel(path: string) {
  const clean = path.split('.').filter((p) => !/^\d+$/.test(p)).join('.');
  if (PATH_LABELS[clean]) return PATH_LABELS[clean];
  const parts = clean.split('.');
  if (parts.length > 2 && /^t[12]$/.test(parts[parts.length - 2])) return `Term ${parts[parts.length - 2][1]} ${fieldLabel(parts[parts.length - 1]).toLowerCase()}`;
  const last = path.split('.').filter((p) => !/^\d+$/.test(p)).pop() ?? path;
  if (LABELS[last]) return LABELS[last];
  const words = last.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const num = (msg: string) => /(-?\d+(\.\d+)?)/.exec(msg)?.[1];

function friendly(constraint: string, raw: string, label: string, property: string) {
  switch (constraint) {
    case 'isNotEmpty':
    case 'isDefined':
      return `${label} is required`;
    case 'isInt':
      return `${label} must be a whole number`;
    case 'isNumber':
    case 'isNumberString':
      return `${label} must be a number`;
    case 'isPositive':
      return `${label} must be more than 0`;
    case 'min':
      return `${label} must be at least ${num(raw.replace(property, ''))}`;
    case 'max':
      return `${label} cannot be more than ${num(raw.replace(property, ''))}`;
    case 'minLength':
      return `${label} must have at least ${num(raw.replace(property, ''))} characters`;
    case 'maxLength':
      return `${label} can have at most ${num(raw.replace(property, ''))} characters`;
    case 'isDateString':
    case 'isDate':
    case 'isISO8601':
      return `${label} must be a valid date`;
    case 'isEmail':
      return `${label} must be a valid email address`;
    case 'isUrl':
      return raw.startsWith(property) ? `${label} must be a full link starting with http:// or https://` : raw;
    case 'isIn':
    case 'isEnum':
      return `Please choose a valid ${label.toLowerCase()}`;
    case 'isBoolean':
      return `${label} must be yes or no`;
    case 'isString':
      return `${label} must be text`;
    case 'isArray':
      return `${label} must be a list`;
    case 'arrayMaxSize':
      return `Too many ${label.toLowerCase()} — at most ${num(raw.replace(property, ''))} at a time`;
    case 'arrayMinSize':
      return `Add at least ${num(raw.replace(property, ''))} ${label.toLowerCase()}`;
    case 'whitelistValidation':
      return `"${label}" is not expected here. Please refresh the page and try again.`;
    default:
      // Custom messages ("mobile must be 10 digits") — just make the field readable
      return raw.startsWith(property) ? `${label}${raw.slice(property.length)}` : raw;
  }
}

/** Readable messages for a list of class-validator errors (also used by Excel import) */
export function validationMessages(errors: ValidationError[], parent = ''): string[] {
  const out: string[] = [];
  for (const e of errors) {
    const path = parent ? `${parent}.${e.property}` : e.property;
    const label = fieldLabel(path);
    const empty = e.value === undefined || e.value === null || (typeof e.value === 'string' && e.value.trim() === '');
    // A missing required field gets one clear message instead of every rule it fails
    if (empty && e.constraints && !e.constraints.whitelistValidation) out.push(`${label} is required`);
    else for (const [constraint, raw] of Object.entries(e.constraints ?? {})) out.push(friendly(constraint, raw, label, e.property));
    if (e.children?.length) out.push(...validationMessages(e.children, path));
  }
  return [...new Set(out)];
}

/** ValidationPipe exceptionFactory */
export function friendlyValidationFactory(errors: ValidationError[]) {
  const messages = validationMessages(errors);
  return new BadRequestException({ message: messages.slice(0, 4).join('. ') + (messages.length > 4 ? ` (+${messages.length - 4} more)` : ''), errors: messages });
}
