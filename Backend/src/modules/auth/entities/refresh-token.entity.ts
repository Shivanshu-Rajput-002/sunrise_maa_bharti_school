import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import { User } from '../../admin/entities/user.entity';

@Table({ tableName: 'refresh_tokens', underscored: true, updatedAt: false })
export class RefreshToken extends Model {
  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: false })
  declare userId: number;

  @BelongsTo(() => User)
  declare user?: User;

  @Column({ type: DataType.STRING(64), allowNull: false, unique: true })
  declare tokenHash: string;

  @Column({ type: DataType.DATE, allowNull: false })
  declare expiresAt: Date;

  @Column({ type: DataType.DATE, allowNull: true })
  declare revokedAt: Date | null;

  @Column({ type: DataType.STRING(45), allowNull: true })
  declare ip: string | null;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare userAgent: string | null;
}
