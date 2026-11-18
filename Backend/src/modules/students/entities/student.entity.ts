import { BelongsTo, Column, DataType, ForeignKey, HasMany, Model, Table } from 'sequelize-typescript';
import { User } from '../../admin/entities/user.entity';
import { StudentEnrollment } from './student-enrollment.entity';

export const GENDERS = ['male', 'female', 'other'] as const;
export const CATEGORIES = ['GEN', 'OBC', 'SC', 'ST', 'SBC', 'EWS'] as const;
export const STUDENT_STATUSES = ['active', 'left', 'passed_out', 'tc_issued'] as const;

export type Gender = (typeof GENDERS)[number];
export type Category = (typeof CATEGORIES)[number];
export type StudentStatus = (typeof STUDENT_STATUSES)[number];

@Table({ tableName: 'students', underscored: true, paranoid: true })
export class Student extends Model {
  @Column({ type: DataType.STRING(30), allowNull: false, unique: true })
  declare admissionNo: string;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  declare admissionDate: string;

  @Column({ type: DataType.STRING(120), allowNull: false })
  declare name: string;

  @Column({ type: DataType.ENUM(...GENDERS), allowNull: false })
  declare gender: Gender;

  @Column({ type: DataType.DATEONLY, allowNull: true })
  declare dob: string | null;

  @Column({ type: DataType.STRING(5), allowNull: true })
  declare bloodGroup: string | null;

  @Column({ type: DataType.ENUM(...CATEGORIES), allowNull: true })
  declare category: Category | null;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare religion: string | null;

  @Column({ type: DataType.STRING(12), allowNull: true, unique: true })
  declare aadharNo: string | null;

  @Column({ type: DataType.STRING(20), allowNull: true, unique: true })
  declare apaarId: string | null;

  @Column({ type: DataType.STRING(20), allowNull: true })
  declare penNo: string | null;

  /** Punch ID used on the biometric attendance machine */
  @Column({ type: DataType.STRING(30), allowNull: true, unique: true })
  declare biometricId: string | null;

  @Column({ type: DataType.STRING(120), allowNull: true })
  declare fatherName: string | null;

  @Column({ type: DataType.STRING(120), allowNull: true })
  declare motherName: string | null;

  @Column({ type: DataType.STRING(10), allowNull: true })
  declare fatherMobile: string | null;

  @Column({ type: DataType.STRING(10), allowNull: true })
  declare motherMobile: string | null;

  @Column({ type: DataType.STRING(10), allowNull: true })
  declare whatsappNo: string | null;

  @Column({ type: DataType.STRING(150), allowNull: true })
  declare email: string | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare address: string | null;

  @Column({ type: DataType.STRING(80), allowNull: true })
  declare city: string | null;

  @Column({ type: DataType.STRING(6), allowNull: true })
  declare pincode: string | null;

  @Column({ type: DataType.STRING(150), allowNull: true })
  declare previousSchool: string | null;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare photoPath: string | null;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: true })
  declare parentUserId: number | null;

  @BelongsTo(() => User, 'parentUserId')
  declare parentUser?: User;

  @Column({ type: DataType.ENUM(...STUDENT_STATUSES), allowNull: false, defaultValue: 'active' })
  declare status: StudentStatus;

  @Column({ type: DataType.DATEONLY, allowNull: true })
  declare leavingDate: string | null;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare leavingReason: string | null;

  @Column({ type: DataType.STRING(30), allowNull: true, unique: true })
  declare tcNo: string | null;

  @Column({ type: DataType.INTEGER, allowNull: true, unique: true })
  declare legacyId: number | null;

  @HasMany(() => StudentEnrollment)
  declare enrollments?: StudentEnrollment[];
}
