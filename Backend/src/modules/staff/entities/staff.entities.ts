import { BelongsTo, Column, DataType, ForeignKey, HasMany, Model, Table } from 'sequelize-typescript';
import { User } from '../../admin/entities/user.entity';

export const STAFF_ATTENDANCE_STATUSES = ['P', 'A', 'L', 'HD'] as const;
export type StaffAttendanceStatus = (typeof STAFF_ATTENDANCE_STATUSES)[number];

/** A member of staff — with or without a login account (drivers, peons need none) */
@Table({ tableName: 'staff', underscored: true })
export class Staff extends Model {
  @Column({ type: DataType.STRING(120), allowNull: false })
  declare name: string;

  @Column({ type: DataType.STRING(60), allowNull: true })
  declare designation: string | null;

  @Column({ type: DataType.STRING(15), allowNull: true })
  declare mobile: string | null;

  /** punchId sent by the biometric machine */
  @Column({ type: DataType.STRING(30), allowNull: true, unique: true })
  declare biometricId: string | null;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: true, unique: true })
  declare userId: number | null;

  @BelongsTo(() => User)
  declare user?: User;

  @Column({ type: DataType.DATEONLY, allowNull: true })
  declare joiningDate: string | null;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare isActive: boolean;

  @HasMany(() => StaffAttendance)
  declare attendance?: StaffAttendance[];
}

@Table({ tableName: 'staff_attendance', underscored: true })
export class StaffAttendance extends Model {
  @ForeignKey(() => Staff)
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: false })
  declare staffId: number;

  @BelongsTo(() => Staff)
  declare staff?: Staff;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  declare date: string;

  @Column({ type: DataType.ENUM(...STAFF_ATTENDANCE_STATUSES), allowNull: false })
  declare status: StaffAttendanceStatus;

  @Column({ type: DataType.TIME, allowNull: true })
  declare inTime: string | null;

  @Column({ type: DataType.TIME, allowNull: true })
  declare outTime: string | null;

  @Column({ type: DataType.ENUM('manual', 'biometric'), allowNull: false, defaultValue: 'manual' })
  declare source: 'manual' | 'biometric';

  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: true })
  declare markedBy: number | null;
}
