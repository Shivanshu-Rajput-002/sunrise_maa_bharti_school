import { Injectable } from '@nestjs/common';
import { Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';

/**
 * Race-safe counters using MySQL's LAST_INSERT_ID(expr) trick:
 * a single atomic UPSERT, no SELECT … FOR UPDATE round-trip, no duplicates under concurrency.
 */
@Injectable()
export class SequenceService {
  constructor(private readonly sequelize: Sequelize) {}

  async next(key: string, transaction?: Transaction): Promise<number> {
    // LAST_INSERT_ID is per-connection: both statements must run on the same connection
    if (!transaction) return this.sequelize.transaction((t) => this.next(key, t));
    await this.sequelize.query(
      'INSERT INTO sequences (`key`, `value`) VALUES (?, LAST_INSERT_ID(1)) ' +
        'ON DUPLICATE KEY UPDATE `value` = LAST_INSERT_ID(`value` + 1)',
      { replacements: [key], transaction },
    );
    const [[row]] = (await this.sequelize.query('SELECT LAST_INSERT_ID() AS v', { transaction })) as [
      { v: number }[],
      unknown,
    ];
    return Number(row.v);
  }

  /** Never go below an existing max (e.g. after manual numbers were entered) */
  async ensureAtLeast(key: string, value: number, transaction?: Transaction) {
    await this.sequelize.query(
      'INSERT INTO sequences (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = GREATEST(`value`, VALUES(`value`))',
      { replacements: [key, value], transaction },
    );
  }
}
