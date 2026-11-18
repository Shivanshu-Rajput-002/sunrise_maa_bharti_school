'use strict';

/**
 * Data needed to print the old-format admit cards and marksheets.
 * Adds columns only — never touches roles/permissions.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const t = await queryInterface.sequelize.transaction();
    try {
      // Which marksheet column an exam fills (T1/T2/T3/HY/AN for Hindi medium, FA1..SA2 for English)
      await queryInterface.addColumn('exams', 'report_column', { type: Sequelize.STRING(8), allowNull: true, after: 'type' }, { transaction: t });
      await queryInterface.addColumn('exams', 'report_column_en', { type: Sequelize.STRING(8), allowNull: true, after: 'report_column' }, { transaction: t });
      await queryInterface.addColumn('exams', 'instructions', { type: Sequelize.TEXT, allowNull: true }, { transaction: t });
      await queryInterface.addColumn('exams', 'result_date', { type: Sequelize.DATEONLY, allowNull: true }, { transaction: t });

      // Theory + practical split (class 11-12)
      await queryInterface.addColumn('exam_schedules', 'practical_max', { type: Sequelize.DECIMAL(6, 2), allowNull: true, after: 'max_marks' }, { transaction: t });
      await queryInterface.addColumn('exam_marks', 'practical_marks', { type: Sequelize.DECIMAL(6, 2), allowNull: true, after: 'marks' }, { transaction: t });

      // Additional subjects print below the main total (Golden India, Freedom Movement, IT, ...)
      await queryInterface.addColumn('subjects', 'is_additional', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false }, { transaction: t });

      // Per-student marksheet extras: SUPW / Art / Jeevan Kaushal marks, co-scholastic grades, health, remark
      await queryInterface.createTable(
        'report_card_extras',
        {
          id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
          session_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, references: { model: 'academic_sessions', key: 'id' }, onDelete: 'CASCADE' },
          enrollment_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, references: { model: 'student_enrollments', key: 'id' }, onDelete: 'CASCADE' },
          data: { type: Sequelize.JSON, allowNull: false },
          updated_by: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        },
        { transaction: t },
      );
      await queryInterface.addIndex('report_card_extras', ['enrollment_id'], { unique: true, name: 'rce_enrollment', transaction: t });
      await queryInterface.addIndex('report_card_extras', ['session_id'], { name: 'rce_session', transaction: t });

      await t.commit();
    } catch (e) {
      await t.rollback();
      throw e;
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('report_card_extras');
    await queryInterface.removeColumn('subjects', 'is_additional');
    await queryInterface.removeColumn('exam_marks', 'practical_marks');
    await queryInterface.removeColumn('exam_schedules', 'practical_max');
    await queryInterface.removeColumn('exams', 'result_date');
    await queryInterface.removeColumn('exams', 'instructions');
    await queryInterface.removeColumn('exams', 'report_column_en');
    await queryInterface.removeColumn('exams', 'report_column');
  },
};
