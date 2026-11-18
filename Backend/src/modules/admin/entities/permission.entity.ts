import { Column, DataType, Model, Table } from 'sequelize-typescript';

@Table({ tableName: 'permissions', underscored: true })
export class Permission extends Model {
  @Column({ type: DataType.STRING(80), allowNull: false, unique: true })
  declare key: string;

  @Column({ type: DataType.STRING(40), allowNull: false })
  declare module: string;

  @Column({ type: DataType.STRING(150), allowNull: true })
  declare description: string | null;
}
