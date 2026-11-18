import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import { SchoolClass } from './school-class.entity';

@Table({ tableName: 'sections', underscored: true })
export class Section extends Model {
  @ForeignKey(() => SchoolClass)
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: false })
  declare classId: number;

  @BelongsTo(() => SchoolClass)
  declare schoolClass?: SchoolClass;

  @Column({ type: DataType.STRING(10), allowNull: false })
  declare name: string;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare isActive: boolean;
}
