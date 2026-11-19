'use strict';

/** Parents see an exam's admit card only after the school releases it. Column only. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('exams', 'admit_card_visible', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false, after: 'is_published' });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('exams', 'admit_card_visible');
  },
};
