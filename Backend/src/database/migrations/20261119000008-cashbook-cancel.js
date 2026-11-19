'use strict';

/**
 * Cashbook entries are cancelled (with a reason), never deleted, so the books keep a full trail.
 * Columns only.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.addColumn('cashbook_entries', 'status', { type: Sequelize.ENUM('active', 'cancelled'), allowNull: false, defaultValue: 'active' }, { transaction: t });
      await queryInterface.addColumn('cashbook_entries', 'cancel_reason', { type: Sequelize.STRING(255), allowNull: true }, { transaction: t });
      await queryInterface.addColumn('cashbook_entries', 'cancelled_by', { type: Sequelize.INTEGER.UNSIGNED, allowNull: true }, { transaction: t });
      await queryInterface.addColumn('cashbook_entries', 'cancelled_at', { type: Sequelize.DATE, allowNull: true }, { transaction: t });
      await t.commit();
    } catch (e) {
      await t.rollback();
      throw e;
    }
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('cashbook_entries', 'cancelled_at');
    await queryInterface.removeColumn('cashbook_entries', 'cancelled_by');
    await queryInterface.removeColumn('cashbook_entries', 'cancel_reason');
    await queryInterface.removeColumn('cashbook_entries', 'status');
  },
};
