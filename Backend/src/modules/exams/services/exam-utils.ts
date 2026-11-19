import { toMoney } from '../../../common/utils/money';
import type { ExamMark, ExamSchedule } from '../entities/exam.entities';

/** Theory + practical max */
export const fullMax = (s: ExamSchedule) => toMoney(toMoney(s.maxMarks) + (s.practicalMax != null ? toMoney(s.practicalMax) : 0));
/** Theory + practical obtained (null when absent / not entered) */
export const markValue = (m?: ExamMark) =>
  !m || m.isAbsent || (m.marks == null && m.practicalMarks == null) ? null : toMoney(toMoney(m.marks ?? 0) + toMoney(m.practicalMarks ?? 0));
