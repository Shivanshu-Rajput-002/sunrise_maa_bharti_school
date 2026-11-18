import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import { jsonColumn } from '../../../common/utils/json-column';
import { User } from '../../admin/entities/user.entity';
import { Student } from './student.entity';

export const CERTIFICATE_TYPES = ['character', 'study', 'transfer'] as const;
export type CertificateType = (typeof CERTIFICATE_TYPES)[number];

@Table({ tableName: 'certificates', underscored: true, updatedAt: false })
export class Certificate extends Model {
  @ForeignKey(() => Student)
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: false })
  declare studentId: number;

  @BelongsTo(() => Student)
  declare student?: Student;

  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: false })
  declare sessionId: number;

  @Column({ type: DataType.ENUM(...CERTIFICATE_TYPES), allowNull: false })
  declare type: CertificateType;

  @Column({ type: DataType.STRING(30), allowNull: false, unique: true })
  declare serialNo: string;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  declare issuedOn: string;

  /** Snapshot of what was printed (class, session, conduct…) so re-prints stay identical */
  @Column(jsonColumn('data'))
  declare data: Record<string, unknown> | null;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: true })
  declare issuedBy: number | null;

  @BelongsTo(() => User, 'issuedBy')
  declare issuer?: User;
}
