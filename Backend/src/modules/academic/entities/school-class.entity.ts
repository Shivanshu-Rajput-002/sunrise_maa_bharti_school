import { BelongsTo, Column, DataType, ForeignKey, HasMany, Model, Table } from 'sequelize-typescript';
import { Section } from './section.entity';

export const CLASS_GROUPS = ['preprimary', 'primary', 'upperprimary', 'secondary', 'highsecondary', 'staff'] as const;
export type ClassGroup = (typeof CLASS_GROUPS)[number];

@Table({ tableName: 'classes', underscored: true })
export class SchoolClass extends Model {
  @Column({ type: DataType.STRING(30), allowNull: false, unique: true })
  declare name: string;

  @Column({ type: DataType.STRING(30), allowNull: true })
  declare nameHi: string | null;

  @Column({ type: DataType.ENUM(...CLASS_GROUPS), allowNull: false })
  declare classGroup: ClassGroup;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  declare sortOrder: number;

  @ForeignKey(() => SchoolClass)
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: true })
  declare nextClassId: number | null;

  @BelongsTo(() => SchoolClass, 'nextClassId')
  declare nextClass?: SchoolClass;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare isActive: boolean;

  @Column({ type: DataType.INTEGER, allowNull: true, unique: true })
  declare legacyId: number | null;

  @HasMany(() => Section)
  declare sections?: Section[];
}
