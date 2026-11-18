'use strict';

/**
 * Phase 2 — students.
 *  students             : one row per child, ever (identity, family, documents)
 *  student_enrollments  : one row per child PER SESSION (medium, class, section, roll no)
 *                         → promotion = new enrollment in the next session; history is never overwritten
 *  sequences            : race-safe counters (admission numbers, later receipts)
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { INTEGER, STRING, BOOLEAN, DATE, DATEONLY, ENUM, TEXT, TINYINT, fn } = Sequelize;
    const pk = { type: INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true };
    const ts = {
      created_at: { type: DATE, allowNull: false, defaultValue: fn('NOW') },
      updated_at: { type: DATE, allowNull: false, defaultValue: fn('NOW') },
    };
    const fk = (table, onDelete = 'RESTRICT') => ({
      type: INTEGER.UNSIGNED,
      references: { model: table, key: 'id' },
      onUpdate: 'CASCADE',
      onDelete,
    });

    await queryInterface.createTable('sequences', {
      key: { type: STRING(60), primaryKey: true }, // e.g. admission:2026
      value: { type: INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    });

    await queryInterface.createTable('students', {
      id: pk,
      admission_no: { type: STRING(30), allowNull: false, unique: true },
      admission_date: { type: DATEONLY, allowNull: false },
      name: { type: STRING(120), allowNull: false },
      gender: { type: ENUM('male', 'female', 'other'), allowNull: false },
      dob: { type: DATEONLY, allowNull: true },
      blood_group: { type: STRING(5), allowNull: true },
      category: { type: ENUM('GEN', 'OBC', 'SC', 'ST', 'SBC', 'EWS'), allowNull: true },
      religion: { type: STRING(40), allowNull: true },
      aadhar_no: { type: STRING(12), allowNull: true, unique: true },
      apaar_id: { type: STRING(20), allowNull: true, unique: true },
      pen_no: { type: STRING(20), allowNull: true }, // UDISE+ permanent education number

      father_name: { type: STRING(120), allowNull: true },
      mother_name: { type: STRING(120), allowNull: true },
      father_mobile: { type: STRING(10), allowNull: true },
      mother_mobile: { type: STRING(10), allowNull: true },
      whatsapp_no: { type: STRING(10), allowNull: true },
      email: { type: STRING(150), allowNull: true },
      address: { type: TEXT, allowNull: true },
      city: { type: STRING(80), allowNull: true },
      pincode: { type: STRING(6), allowNull: true },

      previous_school: { type: STRING(150), allowNull: true },
      photo_path: { type: STRING(255), allowNull: true },
      parent_user_id: { ...fk('users', 'SET NULL'), allowNull: true }, // parent portal login

      status: { type: ENUM('active', 'left', 'passed_out', 'tc_issued'), allowNull: false, defaultValue: 'active' },
      leaving_date: { type: DATEONLY, allowNull: true },
      leaving_reason: { type: STRING(255), allowNull: true },
      tc_no: { type: STRING(30), allowNull: true, unique: true },

      legacy_id: { type: INTEGER, allowNull: true, unique: true },
      ...ts,
      deleted_at: { type: DATE, allowNull: true },
    });
    await queryInterface.addIndex('students', ['name']);
    await queryInterface.addIndex('students', ['father_mobile']);
    await queryInterface.addIndex('students', ['parent_user_id']);
    await queryInterface.addIndex('students', ['status']);

    await queryInterface.createTable('student_enrollments', {
      id: pk,
      student_id: { ...fk('students', 'CASCADE'), allowNull: false },
      session_id: { ...fk('academic_sessions'), allowNull: false },
      medium_id: { type: TINYINT.UNSIGNED, allowNull: false, references: { model: 'mediums', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      class_id: { ...fk('classes'), allowNull: false },
      section_id: { ...fk('sections', 'SET NULL'), allowNull: true },
      roll_no: { type: INTEGER.UNSIGNED, allowNull: true },
      enrollment_type: { type: ENUM('new', 'promoted', 'detained', 'readmission'), allowNull: false, defaultValue: 'new' },
      is_hostel: { type: BOOLEAN, allowNull: false, defaultValue: false },
      uses_transport: { type: BOOLEAN, allowNull: false, defaultValue: false },
      status: { type: ENUM('studying', 'promoted', 'detained', 'left'), allowNull: false, defaultValue: 'studying' },
      remarks: { type: STRING(255), allowNull: true },
      ...ts,
    });
    // One enrollment per student per session
    await queryInterface.addIndex('student_enrollments', ['student_id', 'session_id'], { unique: true });
    // Main listing path: session → medium → class → section (left-prefix also serves session-only and session+medium queries)
    await queryInterface.addIndex('student_enrollments', ['session_id', 'medium_id', 'class_id', 'section_id'], {
      name: 'enr_scope_class_section',
    });
    // Roll numbers unique inside a class/section of a session+medium (NULL roll allowed many times)
    await queryInterface.addIndex('student_enrollments', ['session_id', 'medium_id', 'class_id', 'section_id', 'roll_no'], {
      unique: true,
      name: 'enr_unique_roll',
    });
    await queryInterface.addIndex('student_enrollments', ['class_id']);
    await queryInterface.addIndex('student_enrollments', ['section_id']);
    await queryInterface.addIndex('student_enrollments', ['medium_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('student_enrollments');
    await queryInterface.dropTable('students');
    await queryInterface.dropTable('sequences');
  },
};
