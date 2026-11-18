import { Column, DataType, Model, Table } from 'sequelize-typescript';

@Table({ tableName: 'subjects', underscored: true })
export class Subject extends Model {
  @Column({ type: DataType.STRING(100), allowNull: false, unique: true })
  declare name: string;

  @Column({ type: DataType.STRING(20), allowNull: true, unique: true })
  declare code: string | null;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare isActive: boolean;

  /** Printed below the main total on the marksheet (not counted in the main percentage) */
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  declare isAdditional: boolean;

  @Column({ type: DataType.INTEGER, allowNull: true, unique: true })
  declare legacyId: number | null;
}
