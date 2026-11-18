import { BelongsTo, Column, DataType, DefaultScope, ForeignKey, Model, Scopes, Table } from 'sequelize-typescript';
import { Role } from './role.entity';

@DefaultScope(() => ({ attributes: { exclude: ['passwordHash'] } }))
@Scopes(() => ({ withPassword: { attributes: { include: ['passwordHash'] } } }))
@Table({ tableName: 'users', underscored: true, paranoid: true })
export class User extends Model {
  @Column({ type: DataType.STRING(120), allowNull: false })
  declare name: string;

  @Column({ type: DataType.STRING(80), allowNull: false, unique: true })
  declare username: string;

  @Column({ type: DataType.STRING(150), allowNull: true, unique: true })
  declare email: string | null;

  @Column({ type: DataType.STRING(15), allowNull: true })
  declare mobile: string | null;

  @Column({ type: DataType.STRING(100), allowNull: false })
  declare passwordHash: string;

  @ForeignKey(() => Role)
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: false })
  declare roleId: number;

  @BelongsTo(() => Role)
  declare role?: Role;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare isActive: boolean;

  @Column({ type: DataType.DATE, allowNull: true })
  declare lastLoginAt: Date | null;

  @Column({ type: DataType.INTEGER, allowNull: true, unique: true })
  declare legacyId: number | null;
}
