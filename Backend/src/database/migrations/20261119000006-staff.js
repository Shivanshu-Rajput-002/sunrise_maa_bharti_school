'use strict';

/**
 * Staff directory + staff attendance (manual and biometric).
 * Staff are separate from login accounts: drivers / peons need no login,
 * a teacher's record can optionally link to their user.
 * RBAC: only ADDS the new permission keys — existing role grants are never touched.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.createTable(
        'staff',
        {
          id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
          name: { type: Sequelize.STRING(120), allowNull: false },
          designation: { type: Sequelize.STRING(60), allowNull: true },
          mobile: { type: Sequelize.STRING(15), allowNull: true },
          biometric_id: { type: Sequelize.STRING(30), allowNull: true, unique: true },
          user_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true, unique: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
          joining_date: { type: Sequelize.DATEONLY, allowNull: true },
          is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        },
        { transaction: t },
      );
      await queryInterface.addIndex('staff', ['is_active', 'name'], { name: 'staff_active_name', transaction: t });

      await queryInterface.createTable(
        'staff_attendance',
        {
          id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
          staff_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, references: { model: 'staff', key: 'id' }, onDelete: 'CASCADE' },
          date: { type: Sequelize.DATEONLY, allowNull: false },
          status: { type: Sequelize.ENUM('P', 'A', 'L', 'HD'), allowNull: false },
          in_time: { type: Sequelize.TIME, allowNull: true },
          out_time: { type: Sequelize.TIME, allowNull: true },
          source: { type: Sequelize.ENUM('manual', 'biometric'), allowNull: false, defaultValue: 'manual' },
          marked_by: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        },
        { transaction: t },
      );
      await queryInterface.addIndex('staff_attendance', ['staff_id', 'date'], { unique: true, name: 'sa_staff_date', transaction: t });
      await queryInterface.addIndex('staff_attendance', ['date'], { name: 'sa_date', transaction: t });

      // New permission keys only (no role grants are changed)
      const now = new Date();
      const keys = ['staff.view', 'staff.manage', 'staff.attendance'];
      const [existing] = await queryInterface.sequelize.query('SELECT `key` FROM permissions WHERE `key` IN (?)', { replacements: [keys], transaction: t });
      const have = new Set(existing.map((r) => r.key));
      const add = keys.filter((k) => !have.has(k));
      if (add.length) await queryInterface.bulkInsert('permissions', add.map((key) => ({ key, module: 'staff', created_at: now, updated_at: now })), { transaction: t });

      // Existing staff logins get a staff record so they show up right away
      await queryInterface.sequelize.query(
        `INSERT INTO staff (name, designation, mobile, user_id, is_active, created_at, updated_at)
         SELECT u.name, r.name, u.mobile, u.id, 1, NOW(), NOW()
         FROM users u JOIN roles r ON r.id = u.role_id
         WHERE u.deleted_at IS NULL AND u.is_active = 1 AND r.slug NOT IN ('parent', 'super_admin')`,
        { transaction: t },
      );
      await t.commit();
    } catch (e) {
      await t.rollback();
      throw e;
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('staff_attendance');
    await queryInterface.dropTable('staff');
    await queryInterface.sequelize.query("DELETE FROM permissions WHERE `key` IN ('staff.view','staff.manage','staff.attendance')");
  },
};
