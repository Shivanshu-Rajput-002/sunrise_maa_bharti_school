import { DataType } from 'sequelize-typescript';

/**
 * JSON column options that work on both MySQL 8 (returns objects) and MariaDB
 * (stores JSON as LONGTEXT and returns strings). Parses strings on read.
 */
export function jsonColumn(field: string, allowNull = true) {
  return {
    type: DataType.JSON,
    allowNull,
    get(this: { getDataValue(k: string): unknown }) {
      const raw = this.getDataValue(field);
      if (typeof raw !== 'string') return raw;
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    },
  };
}
