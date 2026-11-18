import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import { SchoolClass } from '../../academic/entities/school-class.entity';
import { User } from '../../admin/entities/user.entity';

export const AUDIENCES = ['all', 'staff', 'parents'] as const;
export type Audience = (typeof AUDIENCES)[number];

@Table({ tableName: 'notices', underscored: true })
export class Notice extends Model {
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: false })
  declare sessionId: number;

  @Column({ type: DataType.STRING(150), allowNull: false })
  declare title: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare body: string | null;

  @Column({ type: DataType.ENUM(...AUDIENCES), allowNull: false, defaultValue: 'all' })
  declare audience: Audience;

  @ForeignKey(() => SchoolClass)
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: true })
  declare classId: number | null;

  @BelongsTo(() => SchoolClass)
  declare schoolClass?: SchoolClass;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  declare publishFrom: string;

  @Column({ type: DataType.DATEONLY, allowNull: true })
  declare publishTo: string | null;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: true })
  declare createdBy: number | null;

  @BelongsTo(() => User, 'createdBy')
  declare creator?: User;
}
