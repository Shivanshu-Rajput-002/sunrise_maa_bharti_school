import { Column, DataType, Model, Table } from 'sequelize-typescript';

@Table({ tableName: 'transport_routes', underscored: true })
export class TransportRoute extends Model {
  @Column({ type: DataType.INTEGER.UNSIGNED, allowNull: false })
  declare sessionId: number;

  @Column({ type: DataType.STRING(100), allowNull: false })
  declare name: string;

  @Column({ type: DataType.DECIMAL(10, 2), allowNull: false, defaultValue: 0 })
  declare annualFee: string;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare isActive: boolean;
}

@Table({ tableName: 'buses', underscored: true })
export class Bus extends Model {
  @Column({ type: DataType.STRING(20), allowNull: false, unique: true })
  declare busNo: string;

  /** Route stops with timings, e.g. "LAXMIPURA (6.45), RAMNAGAR (7.00)" */
  @Column({ type: DataType.STRING(500), allowNull: true })
  declare stops: string | null;

  @Column({ type: DataType.STRING(100), allowNull: true })
  declare driverName: string | null;

  @Column({ type: DataType.STRING(10), allowNull: true })
  declare driverMobile: string | null;

  @Column({ type: DataType.STRING(500), allowNull: true })
  declare gpsUrl: string | null;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare isActive: boolean;
}
