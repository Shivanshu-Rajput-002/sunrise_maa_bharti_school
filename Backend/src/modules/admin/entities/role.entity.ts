import { BelongsToMany, Column, DataType, Model, Table } from 'sequelize-typescript';
import { Permission } from './permission.entity';
import { RolePermission } from './role-permission.entity';

@Table({ tableName: 'roles', underscored: true })
export class Role extends Model {
  @Column({ type: DataType.STRING(50), allowNull: false })
  declare name: string;

  @Column({ type: DataType.STRING(50), allowNull: false, unique: true })
  declare slug: string;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  declare isSystem: boolean;

  @BelongsToMany(() => Permission, () => RolePermission)
  declare permissions?: Permission[];
}
