import { Column, DataType, Model, Table } from 'sequelize-typescript';
import { jsonColumn } from '../../../common/utils/json-column';
import type { MarksheetExtras } from '../../../common/pdf/print-templates';

/** Per-student marksheet extras (SUPW / Art / Jeevan Kaushal, co-scholastic grades, health, remark) */
@Table({ tableName: 'report_card_extras', underscored: true })
export class ReportCardExtra extends Model {
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: false })
  declare sessionId: number;

  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: false, unique: true })
  declare enrollmentId: number;

  @Column(jsonColumn('data', false))
  declare data: MarksheetExtras;

  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: true })
  declare updatedBy: number | null;
}
