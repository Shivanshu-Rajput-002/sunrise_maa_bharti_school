import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import { jsonColumn } from '../../../common/utils/json-column';
import { User } from './user.entity';

@Table({ tableName: 'audit_logs', underscored: true, updatedAt: false })
export class AuditLog extends Model {
  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: true })
  declare userId: number | null;

  /** Who did it (kept even if the user is later deleted) */
  @BelongsTo(() => User, { constraints: false })
  declare user?: User;

  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: true })
  declare sessionId: number | null;

  @Column({ type: DataType.STRING(40), allowNull: false })
  declare action: string;

  @Column({ type: DataType.STRING(60), allowNull: false })
  declare entity: string;

  @Column({ type: DataType.STRING(40), allowNull: true })
  declare entityId: string | null;

  @Column(jsonColumn('meta'))
  declare meta: Record<string, unknown> | null;

  @Column({ type: DataType.STRING(45), allowNull: true })
  declare ip: string | null;
}
