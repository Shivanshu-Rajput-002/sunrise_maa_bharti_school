import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import { AcademicSession } from '../../academic/entities/academic-session.entity';
import { Medium } from '../../academic/entities/medium.entity';
import { SchoolClass } from '../../academic/entities/school-class.entity';
import { Section } from '../../academic/entities/section.entity';
import { Student } from './student.entity';

export const ENROLLMENT_TYPES = ['new', 'promoted', 'detained', 'readmission'] as const;
export const ENROLLMENT_STATUSES = ['studying', 'promoted', 'detained', 'left'] as const;
export type EnrollmentType = (typeof ENROLLMENT_TYPES)[number];
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

@Table({ tableName: 'student_enrollments', underscored: true })
export class StudentEnrollment extends Model {
  @ForeignKey(() => Student)
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: false })
  declare studentId: number;

  @BelongsTo(() => Student)
  declare student?: Student;

  @ForeignKey(() => AcademicSession)
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: false })
  declare sessionId: number;

  @BelongsTo(() => AcademicSession)
  declare session?: AcademicSession;

  @ForeignKey(() => Medium)
  @Column({ type: DataType.TINYINT.UNSIGNED, allowNull: false })
  declare mediumId: number;

  @BelongsTo(() => Medium)
  declare medium?: Medium;

  @ForeignKey(() => SchoolClass)
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: false })
  declare classId: number;

  @BelongsTo(() => SchoolClass)
  declare schoolClass?: SchoolClass;

  @ForeignKey(() => Section)
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: true })
  declare sectionId: number | null;

  @BelongsTo(() => Section)
  declare section?: Section;

  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: true })
  declare rollNo: number | null;

  @Column({ type: DataType.ENUM(...ENROLLMENT_TYPES), allowNull: false, defaultValue: 'new' })
  declare enrollmentType: EnrollmentType;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  declare isHostel: boolean;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  declare usesTransport: boolean;

  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: true })
  declare transportRouteId: number | null;

  @Column({ type: DataType.ENUM(...ENROLLMENT_STATUSES), allowNull: false, defaultValue: 'studying' })
  declare status: EnrollmentStatus;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare remarks: string | null;
}
