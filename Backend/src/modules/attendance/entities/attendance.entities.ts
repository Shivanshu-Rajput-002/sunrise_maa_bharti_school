import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import { StudentEnrollment } from '../../students/entities/student-enrollment.entity';

export const ATTENDANCE_STATUSES = ['P', 'A', 'L', 'HD'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

@Table({ tableName: 'holidays', underscored: true })
export class Holiday extends Model {
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: false })
  declare sessionId: number;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  declare date: string;

  @Column({ type: DataType.STRING(120), allowNull: false })
  declare title: string;
}

@Table({ tableName: 'attendance', underscored: true })
export class Attendance extends Model {
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: false })
  declare sessionId: number;

  @ForeignKey(() => StudentEnrollment)
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: false })
  declare enrollmentId: number;

  @BelongsTo(() => StudentEnrollment)
  declare enrollment?: StudentEnrollment;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  declare date: string;

  @Column({ type: DataType.ENUM(...ATTENDANCE_STATUSES), allowNull: false })
  declare status: AttendanceStatus;

  @Column({ type: DataType.ENUM('manual', 'biometric'), allowNull: false, defaultValue: 'manual' })
  declare source: 'manual' | 'biometric';

  @Column({ type: DataType.TIME, allowNull: true })
  declare inTime: string | null;

  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: true })
  declare markedBy: number | null;
}

@Table({ tableName: 'biometric_devices', underscored: true })
export class BiometricDevice extends Model {
  @Column({ type: DataType.STRING(80), allowNull: false })
  declare name: string;

  @Column({ type: DataType.STRING(64), allowNull: false, unique: true })
  declare keyHash: string;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare isActive: boolean;

  @Column({ type: DataType.DATE, allowNull: true })
  declare lastSeenAt: Date | null;
}
