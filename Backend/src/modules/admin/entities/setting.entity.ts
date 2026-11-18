import { Column, DataType, Model, Table } from 'sequelize-typescript';
import { jsonColumn } from '../../../common/utils/json-column';

@Table({ tableName: 'settings', underscored: true, createdAt: false })
export class Setting extends Model {
  @Column({ type: DataType.STRING(80), primaryKey: true })
  declare key: string;

  @Column(jsonColumn('value'))
  declare value: unknown;
}
