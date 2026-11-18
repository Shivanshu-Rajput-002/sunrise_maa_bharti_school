import { Column, DataType, Model, Table } from 'sequelize-typescript';

@Table({ tableName: 'mediums', underscored: true })
export class Medium extends Model {
  @Column({ type: DataType.STRING(5), allowNull: false, unique: true })
  declare code: string;

  @Column({ type: DataType.STRING(30), allowNull: false })
  declare name: string;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare isActive: boolean;
}
