import { Column, DataType, Model, Table } from 'sequelize-typescript';
import { jsonColumn } from '../../../common/utils/json-column';

@Table({ tableName: 'audit_logs', underscored: true, updatedAt: false })
export class AuditLog extends Model {
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: true })
  declare userId: number | null;

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
