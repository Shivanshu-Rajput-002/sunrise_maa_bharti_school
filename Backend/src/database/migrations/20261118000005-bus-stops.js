'use strict';

/** Route stops with timings shown with each bus (as on the old site's Bus GPS list). Columns only. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('buses', 'stops', { type: Sequelize.STRING(500), allowNull: true, after: 'bus_no' });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('buses', 'stops');
  },
};
