import { Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import { Permission } from './permission.entity';
import { Role } from './role.entity';

@Table({ tableName: 'role_permissions', underscored: true, timestamps: false })
export class RolePermission extends Model {
  @ForeignKey(() => Role)
  @Column({ type: DataType.INTEGER.UNSIGNED, primaryKey: true })
  declare roleId: number;

  @ForeignKey(() => Permission)
  @Column({ type: DataType.INTEGER.UNSIGNED, primaryKey: true })
  declare permissionId: number;
}
