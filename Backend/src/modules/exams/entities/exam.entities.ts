import { BelongsTo, Column, DataType, ForeignKey, HasMany, Model, Table } from 'sequelize-typescript';
import { SchoolClass } from '../../academic/entities/school-class.entity';
import { Subject } from '../../academic/entities/subject.entity';
import { StudentEnrollment } from '../../students/entities/student-enrollment.entity';

export const EXAM_TYPES = ['class_test', 'unit_test', 'term', 'annual'] as const;
export type ExamType = (typeof EXAM_TYPES)[number];

/** Marksheet columns: Hindi medium (tests, half-yearly, annual) and English medium (FA/SA terms) */
export const REPORT_COLUMNS_HI = ['T1', 'T2', 'T3', 'HY', 'AN'] as const;
export const REPORT_COLUMNS_EN = ['FA1', 'FA2', 'SA1', 'FA3', 'FA4', 'SA2'] as const;
export type ReportColumn = (typeof REPORT_COLUMNS_HI)[number];
export type ReportColumnEn = (typeof REPORT_COLUMNS_EN)[number];

@Table({ tableName: 'exams', underscored: true })
export class Exam extends Model {
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: false })
  declare sessionId: number;

  @Column({ type: DataType.STRING(100), allowNull: false })
  declare name: string;

  @Column({ type: DataType.ENUM(...EXAM_TYPES), allowNull: false })
  declare type: ExamType;

  /** Column on the Hindi-medium marksheet */
  @Column({ type: DataType.STRING(8), allowNull: true })
  declare reportColumn: ReportColumn | null;

  /** Column on the English-medium marksheet (same exam, FA/SA naming) */
  @Column({ type: DataType.STRING(8), allowNull: true })
  declare reportColumnEn: ReportColumnEn | null;

  /** Admit card notes, one per line */
  @Column({ type: DataType.TEXT, allowNull: true })
  declare instructions: string | null;

  /** Declaration date printed on the marksheet */
  @Column({ type: DataType.DATEONLY, allowNull: true })
  declare resultDate: string | null;

  @Column({ type: DataType.DATEONLY, allowNull: true })
  declare startDate: string | null;

  @Column({ type: DataType.DATEONLY, allowNull: true })
  declare endDate: string | null;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare includeInReport: boolean;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  declare isPublished: boolean;

  /** Parents can download the admit card only when this is on */
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  declare admitCardVisible: boolean;

  @HasMany(() => ExamSchedule)
  declare schedules?: ExamSchedule[];
}

@Table({ tableName: 'exam_schedules', underscored: true })
export class ExamSchedule extends Model {
  @ForeignKey(() => Exam)
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: false })
  declare examId: number;

  @BelongsTo(() => Exam)
  declare exam?: Exam;

  @ForeignKey(() => SchoolClass)
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: false })
  declare classId: number;

  @BelongsTo(() => SchoolClass)
  declare schoolClass?: SchoolClass;

  @ForeignKey(() => Subject)
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: false })
  declare subjectId: number;

  @BelongsTo(() => Subject)
  declare subject?: Subject;

  @Column({ type: DataType.DATEONLY, allowNull: true })
  declare examDate: string | null;

  @Column({ type: DataType.TIME, allowNull: true })
  declare startTime: string | null;

  @Column({ type: DataType.TIME, allowNull: true })
  declare endTime: string | null;

  @Column({ type: DataType.DECIMAL(6, 2), allowNull: false, defaultValue: 100 })
  declare maxMarks: string;

  /** Practical max (class 11-12); maxMarks is then the theory max */
  @Column({ type: DataType.DECIMAL(6, 2), allowNull: true })
  declare practicalMax: string | null;

  @Column({ type: DataType.DECIMAL(6, 2), allowNull: false, defaultValue: 33 })
  declare passMarks: string;

  @HasMany(() => ExamMark)
  declare marks?: ExamMark[];
}

@Table({ tableName: 'exam_marks', underscored: true })
export class ExamMark extends Model {
  @ForeignKey(() => ExamSchedule)
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: false })
  declare scheduleId: number;

  @BelongsTo(() => ExamSchedule)
  declare schedule?: ExamSchedule;

  @ForeignKey(() => StudentEnrollment)
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: false })
  declare enrollmentId: number;

  @Column({ type: DataType.DECIMAL(6, 2), allowNull: true })
  declare marks: string | null;

  @Column({ type: DataType.DECIMAL(6, 2), allowNull: true })
  declare practicalMarks: string | null;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  declare isAbsent: boolean;

  @Column({ type: DataType.STRING(150), allowNull: true })
  declare remarks: string | null;

  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: true })
  declare enteredBy: number | null;
}
