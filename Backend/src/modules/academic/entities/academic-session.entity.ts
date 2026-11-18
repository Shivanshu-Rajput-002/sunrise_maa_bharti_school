import { Column, DataType, Model, Table } from 'sequelize-typescript';

@Table({ tableName: 'academic_sessions', underscored: true })
export class AcademicSession extends Model {
  @Column({ type: DataType.STRING(20), allowNull: false, unique: true })
  declare name: string;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  declare startDate: string;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  declare endDate: string;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  declare isCurrent: boolean;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare isActive: boolean;
}
