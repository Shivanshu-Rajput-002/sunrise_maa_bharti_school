import { BelongsTo, Column, DataType, ForeignKey, HasMany, Model, Table } from 'sequelize-typescript';
import { User } from '../../admin/entities/user.entity';
import { Medium } from '../../academic/entities/medium.entity';
import { StudentEnrollment } from '../../students/entities/student-enrollment.entity';
import { Student } from '../../students/entities/student.entity';

export const PAYMENT_MODES = ['cash', 'upi', 'online', 'cheque', 'bank'] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

@Table({ tableName: 'fee_heads', underscored: true })
export class FeeHead extends Model {
  @Column({ type: DataType.STRING(60), allowNull: false, unique: true })
  declare name: string;

  @Column({ type: DataType.ENUM('all', 'hostel'), allowNull: false, defaultValue: 'all' })
  declare appliesTo: 'all' | 'hostel';

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare sortOrder: number;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare isActive: boolean;
}

@Table({ tableName: 'fee_installments', underscored: true })
export class FeeInstallment extends Model {
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: false })
  declare sessionId: number;

  @Column({ type: DataType.STRING(60), allowNull: false })
  declare name: string;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  declare dueDate: string;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare sortOrder: number;
}

@Table({ tableName: 'fee_structures', underscored: true })
export class FeeStructure extends Model {
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: false })
  declare sessionId: number;

  @Column({ type: DataType.TINYINT.UNSIGNED, allowNull: false })
  declare mediumId: number;

  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: false })
  declare classId: number;

  @ForeignKey(() => FeeInstallment)
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: false })
  declare installmentId: number;

  @ForeignKey(() => FeeHead)
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: false })
  declare feeHeadId: number;

  @BelongsTo(() => FeeHead)
  declare feeHead?: FeeHead;

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: false, defaultValue: 0 })
  declare amount: string;
}

@Table({ tableName: 'fee_concessions', underscored: true })
export class FeeConcession extends Model {
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: false, unique: true })
  declare enrollmentId: number;

  @Column({ type: DataType.ENUM('percent', 'fixed'), allowNull: false })
  declare type: 'percent' | 'fixed';

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: false, defaultValue: 0 })
  declare value: string;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare reason: string | null;
}

@Table({ tableName: 'fee_payments', underscored: true })
export class FeePayment extends Model {
  @Column({ type: DataType.STRING(30), allowNull: false, unique: true })
  declare receiptNo: string;

  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: false })
  declare sessionId: number;

  @ForeignKey(() => Medium)
  @Column({ type: DataType.TINYINT.UNSIGNED, allowNull: false })
  declare mediumId: number;

  @BelongsTo(() => Medium)
  declare medium?: Medium;

  @ForeignKey(() => StudentEnrollment)
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: false })
  declare enrollmentId: number;

  @BelongsTo(() => StudentEnrollment)
  declare enrollment?: StudentEnrollment;

  @ForeignKey(() => Student)
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: false })
  declare studentId: number;

  @BelongsTo(() => Student)
  declare student?: Student;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  declare paymentDate: string;

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: false, defaultValue: 0 })
  declare grossAmount: string;

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: false, defaultValue: 0 })
  declare discount: string;

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: false, defaultValue: 0 })
  declare fine: string;

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: false, defaultValue: 0 })
  declare netAmount: string;

  @Column({ type: DataType.ENUM(...PAYMENT_MODES), allowNull: false, defaultValue: 'cash' })
  declare mode: PaymentMode;

  @Column({ type: DataType.STRING(100), allowNull: true })
  declare reference: string | null;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare remarks: string | null;

  @Column({ type: DataType.ENUM('paid', 'cancelled'), allowNull: false, defaultValue: 'paid' })
  declare status: 'paid' | 'cancelled';

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare cancelReason: string | null;

  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: true })
  declare cancelledBy: number | null;

  @Column({ type: DataType.DATE, allowNull: true })
  declare cancelledAt: Date | null;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: true })
  declare collectedBy: number | null;

  @BelongsTo(() => User, 'collectedBy')
  declare collector?: User;

  @HasMany(() => FeePaymentItem)
  declare items?: FeePaymentItem[];
}

@Table({ tableName: 'fee_payment_items', underscored: true, timestamps: false })
export class FeePaymentItem extends Model {
  @ForeignKey(() => FeePayment)
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: false })
  declare paymentId: number;

  @BelongsTo(() => FeePayment)
  declare payment?: FeePayment;

  @ForeignKey(() => FeeInstallment)
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: false })
  declare installmentId: number;

  @BelongsTo(() => FeeInstallment)
  declare installment?: FeeInstallment;

  /** null = transport fee */
  @ForeignKey(() => FeeHead)
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: true })
  declare feeHeadId: number | null;

  @BelongsTo(() => FeeHead)
  declare feeHead?: FeeHead;

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: false, defaultValue: 0 })
  declare amount: string;
}

// ---------------- Cashbook ----------------
@Table({ tableName: 'cashbook_heads', underscored: true })
export class CashbookHead extends Model {
  @Column({ type: DataType.STRING(80), allowNull: false })
  declare name: string;

  @Column({ type: DataType.ENUM('income', 'expense'), allowNull: false })
  declare type: 'income' | 'expense';

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare isActive: boolean;
}

@Table({ tableName: 'cashbook_entries', underscored: true })
export class CashbookEntry extends Model {
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: false })
  declare sessionId: number;

  @ForeignKey(() => CashbookHead)
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: false })
  declare headId: number;

  @BelongsTo(() => CashbookHead)
  declare head?: CashbookHead;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  declare entryDate: string;

  @Column({ type: DataType.ENUM('income', 'expense'), allowNull: false })
  declare type: 'income' | 'expense';

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: false, defaultValue: 0 })
  declare amount: string;

  @Column({ type: DataType.STRING(120), allowNull: true })
  declare party: string | null;

  @Column({ type: DataType.ENUM(...PAYMENT_MODES), allowNull: false, defaultValue: 'cash' })
  declare mode: PaymentMode;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare remarks: string | null;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: true })
  declare createdBy: number | null;

  @BelongsTo(() => User, 'createdBy')
  declare creator?: User;
}
