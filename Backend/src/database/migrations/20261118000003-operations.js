'use strict';

/**
 * Phase 3 — school operations: transport, fees, cashbook, attendance, exams,
 * notices, certificates. Every transactional table carries session_id and is
 * indexed with session_id first so sessions never mix and scoped queries stay fast.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { INTEGER, STRING, BOOLEAN, DATE, DATEONLY, ENUM, TEXT, TINYINT, BIGINT, DECIMAL, TIME, JSON, fn } = Sequelize;
    const pk = { type: INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true };
    const bigPk = { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true };
    const ts = {
      created_at: { type: DATE, allowNull: false, defaultValue: fn('NOW') },
      updated_at: { type: DATE, allowNull: false, defaultValue: fn('NOW') },
    };
    const fk = (table, onDelete = 'RESTRICT', type = INTEGER.UNSIGNED) => ({
      type,
      references: { model: table, key: 'id' },
      onUpdate: 'CASCADE',
      onDelete,
    });
    const money = { type: DECIMAL(10, 2), allowNull: false, defaultValue: 0 };

    // ---------------- Transport ----------------
    await queryInterface.createTable('transport_routes', {
      id: pk,
      session_id: { ...fk('academic_sessions'), allowNull: false },
      name: { type: STRING(100), allowNull: false }, // village / stop
      annual_fee: money,
      is_active: { type: BOOLEAN, allowNull: false, defaultValue: true },
      ...ts,
    });
    await queryInterface.addIndex('transport_routes', ['session_id', 'name'], { unique: true });

    await queryInterface.createTable('buses', {
      id: pk,
      bus_no: { type: STRING(20), allowNull: false, unique: true },
      driver_name: { type: STRING(100), allowNull: true },
      driver_mobile: { type: STRING(10), allowNull: true },
      gps_url: { type: STRING(500), allowNull: true },
      is_active: { type: BOOLEAN, allowNull: false, defaultValue: true },
      ...ts,
    });

    await queryInterface.addColumn('student_enrollments', 'transport_route_id', {
      ...fk('transport_routes', 'SET NULL'),
      allowNull: true,
    });
    await queryInterface.addIndex('student_enrollments', ['transport_route_id']);
    await queryInterface.addColumn('students', 'biometric_id', { type: STRING(30), allowNull: true, unique: true });

    // ---------------- Fees ----------------
    await queryInterface.createTable('fee_heads', {
      id: pk,
      name: { type: STRING(60), allowNull: false, unique: true },
      // all = every student, hostel = only hostel students. Transport fee comes from the route.
      applies_to: { type: ENUM('all', 'hostel'), allowNull: false, defaultValue: 'all' },
      sort_order: { type: INTEGER, allowNull: false, defaultValue: 0 },
      is_active: { type: BOOLEAN, allowNull: false, defaultValue: true },
      ...ts,
    });

    await queryInterface.createTable('fee_installments', {
      id: pk,
      session_id: { ...fk('academic_sessions'), allowNull: false },
      name: { type: STRING(60), allowNull: false },
      due_date: { type: DATEONLY, allowNull: false },
      sort_order: { type: INTEGER, allowNull: false, defaultValue: 0 },
      ...ts,
    });
    await queryInterface.addIndex('fee_installments', ['session_id', 'name'], { unique: true });

    await queryInterface.createTable('fee_structures', {
      id: pk,
      session_id: { ...fk('academic_sessions'), allowNull: false },
      medium_id: { ...fk('mediums', 'RESTRICT', TINYINT.UNSIGNED), allowNull: false },
      class_id: { ...fk('classes'), allowNull: false },
      installment_id: { ...fk('fee_installments', 'CASCADE'), allowNull: false },
      fee_head_id: { ...fk('fee_heads'), allowNull: false },
      amount: money,
      ...ts,
    });
    await queryInterface.addIndex('fee_structures', ['session_id', 'medium_id', 'class_id', 'installment_id', 'fee_head_id'], {
      unique: true,
      name: 'fee_structure_unique',
    });
    await queryInterface.addIndex('fee_structures', ['installment_id']);
    await queryInterface.addIndex('fee_structures', ['fee_head_id']);
    await queryInterface.addIndex('fee_structures', ['class_id']);
    await queryInterface.addIndex('fee_structures', ['medium_id']);

    await queryInterface.createTable('fee_concessions', {
      id: pk,
      enrollment_id: { ...fk('student_enrollments', 'CASCADE'), allowNull: false, unique: true },
      type: { type: ENUM('percent', 'fixed'), allowNull: false },
      value: money,
      reason: { type: STRING(255), allowNull: true },
      ...ts,
    });

    await queryInterface.createTable('fee_payments', {
      id: pk,
      receipt_no: { type: STRING(30), allowNull: false, unique: true },
      session_id: { ...fk('academic_sessions'), allowNull: false },
      medium_id: { ...fk('mediums', 'RESTRICT', TINYINT.UNSIGNED), allowNull: false },
      enrollment_id: { ...fk('student_enrollments'), allowNull: false },
      student_id: { ...fk('students'), allowNull: false },
      payment_date: { type: DATEONLY, allowNull: false },
      gross_amount: money, // sum of items
      discount: money, // e.g. full-payment cash discount
      fine: money, // late fee
      net_amount: money, // gross - discount + fine
      mode: { type: ENUM('cash', 'upi', 'online', 'cheque', 'bank'), allowNull: false, defaultValue: 'cash' },
      reference: { type: STRING(100), allowNull: true },
      remarks: { type: STRING(255), allowNull: true },
      status: { type: ENUM('paid', 'cancelled'), allowNull: false, defaultValue: 'paid' },
      cancel_reason: { type: STRING(255), allowNull: true },
      cancelled_by: { ...fk('users', 'SET NULL'), allowNull: true },
      cancelled_at: { type: DATE, allowNull: true },
      collected_by: { ...fk('users', 'SET NULL'), allowNull: true },
      ...ts,
    });
    await queryInterface.addIndex('fee_payments', ['session_id', 'medium_id', 'payment_date'], { name: 'fee_pay_scope_date' });
    await queryInterface.addIndex('fee_payments', ['session_id', 'payment_date']);
    await queryInterface.addIndex('fee_payments', ['enrollment_id', 'status']);
    await queryInterface.addIndex('fee_payments', ['student_id']);
    await queryInterface.addIndex('fee_payments', ['medium_id']);
    await queryInterface.addIndex('fee_payments', ['collected_by']);
    await queryInterface.addIndex('fee_payments', ['cancelled_by']);

    await queryInterface.createTable('fee_payment_items', {
      id: bigPk,
      payment_id: { ...fk('fee_payments', 'CASCADE'), allowNull: false },
      installment_id: { ...fk('fee_installments'), allowNull: false },
      // NULL fee_head = transport fee for that installment
      fee_head_id: { ...fk('fee_heads'), allowNull: true },
      amount: money,
    });
    await queryInterface.addIndex('fee_payment_items', ['payment_id']);
    await queryInterface.addIndex('fee_payment_items', ['installment_id', 'fee_head_id']);
    await queryInterface.addIndex('fee_payment_items', ['fee_head_id']);

    // ---------------- Cashbook ----------------
    await queryInterface.createTable('cashbook_heads', {
      id: pk,
      name: { type: STRING(80), allowNull: false },
      type: { type: ENUM('income', 'expense'), allowNull: false },
      is_active: { type: BOOLEAN, allowNull: false, defaultValue: true },
      ...ts,
    });
    await queryInterface.addIndex('cashbook_heads', ['type', 'name'], { unique: true });

    await queryInterface.createTable('cashbook_entries', {
      id: pk,
      session_id: { ...fk('academic_sessions'), allowNull: false },
      head_id: { ...fk('cashbook_heads'), allowNull: false },
      entry_date: { type: DATEONLY, allowNull: false },
      type: { type: ENUM('income', 'expense'), allowNull: false },
      amount: money,
      party: { type: STRING(120), allowNull: true },
      mode: { type: ENUM('cash', 'upi', 'online', 'cheque', 'bank'), allowNull: false, defaultValue: 'cash' },
      remarks: { type: STRING(255), allowNull: true },
      created_by: { ...fk('users', 'SET NULL'), allowNull: true },
      ...ts,
    });
    await queryInterface.addIndex('cashbook_entries', ['session_id', 'entry_date']);
    await queryInterface.addIndex('cashbook_entries', ['head_id']);
    await queryInterface.addIndex('cashbook_entries', ['created_by']);

    // ---------------- Attendance ----------------
    await queryInterface.createTable('holidays', {
      id: pk,
      session_id: { ...fk('academic_sessions'), allowNull: false },
      date: { type: DATEONLY, allowNull: false },
      title: { type: STRING(120), allowNull: false },
      ...ts,
    });
    await queryInterface.addIndex('holidays', ['session_id', 'date'], { unique: true });

    await queryInterface.createTable('attendance', {
      id: bigPk,
      session_id: { ...fk('academic_sessions'), allowNull: false },
      enrollment_id: { ...fk('student_enrollments', 'CASCADE'), allowNull: false },
      date: { type: DATEONLY, allowNull: false },
      status: { type: ENUM('P', 'A', 'L', 'HD'), allowNull: false }, // present, absent, leave, half-day
      source: { type: ENUM('manual', 'biometric'), allowNull: false, defaultValue: 'manual' },
      in_time: { type: TIME, allowNull: true },
      marked_by: { ...fk('users', 'SET NULL'), allowNull: true },
      ...ts,
    });
    await queryInterface.addIndex('attendance', ['enrollment_id', 'date'], { unique: true });
    await queryInterface.addIndex('attendance', ['session_id', 'date', 'status']);
    await queryInterface.addIndex('attendance', ['marked_by']);

    await queryInterface.createTable('biometric_devices', {
      id: pk,
      name: { type: STRING(80), allowNull: false },
      key_hash: { type: STRING(64), allowNull: false, unique: true }, // sha256 of the device API key
      is_active: { type: BOOLEAN, allowNull: false, defaultValue: true },
      last_seen_at: { type: DATE, allowNull: true },
      ...ts,
    });

    // ---------------- Exams ----------------
    await queryInterface.createTable('exams', {
      id: pk,
      session_id: { ...fk('academic_sessions'), allowNull: false },
      name: { type: STRING(100), allowNull: false },
      type: { type: ENUM('class_test', 'unit_test', 'term', 'annual'), allowNull: false },
      start_date: { type: DATEONLY, allowNull: true },
      end_date: { type: DATEONLY, allowNull: true },
      include_in_report: { type: BOOLEAN, allowNull: false, defaultValue: true },
      is_published: { type: BOOLEAN, allowNull: false, defaultValue: false }, // results visible to parents
      ...ts,
    });
    await queryInterface.addIndex('exams', ['session_id', 'type']);

    await queryInterface.createTable('exam_schedules', {
      id: pk,
      exam_id: { ...fk('exams', 'CASCADE'), allowNull: false },
      class_id: { ...fk('classes'), allowNull: false },
      subject_id: { ...fk('subjects'), allowNull: false },
      exam_date: { type: DATEONLY, allowNull: true },
      start_time: { type: TIME, allowNull: true },
      end_time: { type: TIME, allowNull: true },
      max_marks: { type: DECIMAL(6, 2), allowNull: false, defaultValue: 100 },
      pass_marks: { type: DECIMAL(6, 2), allowNull: false, defaultValue: 33 },
      ...ts,
    });
    await queryInterface.addIndex('exam_schedules', ['exam_id', 'class_id', 'subject_id'], { unique: true });
    await queryInterface.addIndex('exam_schedules', ['class_id']);
    await queryInterface.addIndex('exam_schedules', ['subject_id']);

    await queryInterface.createTable('exam_marks', {
      id: bigPk,
      schedule_id: { ...fk('exam_schedules', 'CASCADE'), allowNull: false },
      enrollment_id: { ...fk('student_enrollments', 'CASCADE'), allowNull: false },
      marks: { type: DECIMAL(6, 2), allowNull: true },
      is_absent: { type: BOOLEAN, allowNull: false, defaultValue: false },
      remarks: { type: STRING(150), allowNull: true },
      entered_by: { ...fk('users', 'SET NULL'), allowNull: true },
      ...ts,
    });
    await queryInterface.addIndex('exam_marks', ['schedule_id', 'enrollment_id'], { unique: true });
    await queryInterface.addIndex('exam_marks', ['enrollment_id']);
    await queryInterface.addIndex('exam_marks', ['entered_by']);

    // ---------------- Communication ----------------
    await queryInterface.createTable('notices', {
      id: pk,
      session_id: { ...fk('academic_sessions'), allowNull: false },
      title: { type: STRING(150), allowNull: false },
      body: { type: TEXT, allowNull: true },
      audience: { type: ENUM('all', 'staff', 'parents'), allowNull: false, defaultValue: 'all' },
      class_id: { ...fk('classes', 'SET NULL'), allowNull: true }, // null = all classes
      publish_from: { type: DATEONLY, allowNull: false },
      publish_to: { type: DATEONLY, allowNull: true },
      created_by: { ...fk('users', 'SET NULL'), allowNull: true },
      ...ts,
    });
    await queryInterface.addIndex('notices', ['session_id', 'publish_from']);
    await queryInterface.addIndex('notices', ['class_id']);
    await queryInterface.addIndex('notices', ['created_by']);

    // ---------------- Certificates register ----------------
    await queryInterface.createTable('certificates', {
      id: pk,
      student_id: { ...fk('students'), allowNull: false },
      session_id: { ...fk('academic_sessions'), allowNull: false },
      type: { type: ENUM('character', 'study', 'transfer'), allowNull: false },
      serial_no: { type: STRING(30), allowNull: false, unique: true },
      issued_on: { type: DATEONLY, allowNull: false },
      data: { type: JSON, allowNull: true }, // snapshot printed on the certificate
      issued_by: { ...fk('users', 'SET NULL'), allowNull: true },
      created_at: { type: DATE, allowNull: false, defaultValue: fn('NOW') },
    });
    await queryInterface.addIndex('certificates', ['student_id', 'type']);
    await queryInterface.addIndex('certificates', ['session_id']);
    await queryInterface.addIndex('certificates', ['issued_by']);

    // ---------------- RBAC sync (drop removed modules, add new permissions) ----------------
    const rbac = require('../../common/constants/rbac.json');
    const keys = Object.entries(rbac.modules).flatMap(([m, a]) => a.map((x) => `${m}.${x}`));
    const q = queryInterface.sequelize;
    await q.query('DELETE FROM permissions WHERE `key` NOT IN (?)', { replacements: [keys] });
    const [existing] = await q.query('SELECT `key` FROM permissions');
    const have = new Set(existing.map((r) => r.key));
    const added = keys.filter((k) => !have.has(k));
    if (added.length) {
      const now = new Date();
      await queryInterface.bulkInsert('permissions', added.map((key) => ({ key, module: key.split('.')[0], created_at: now, updated_at: now })));
    }
    // Reset system roles to the registry defaults (no custom edits exist yet at this stage)
    const [perms] = await q.query('SELECT id, `key` FROM permissions');
    const [roles] = await q.query('SELECT id, slug FROM roles WHERE is_system = 1');
    const match = (patterns, k) => patterns === '*' || patterns.some((p) => p === k || (p.endsWith('.*') && k.startsWith(p.slice(0, -1))));
    for (const role of roles) {
      const def = rbac.roles[role.slug];
      if (!def) continue;
      await q.query('DELETE FROM role_permissions WHERE role_id = ?', { replacements: [role.id] });
      const rows = perms.filter((p) => match(def.permissions, p.key)).map((p) => ({ role_id: role.id, permission_id: p.id }));
      if (rows.length) await queryInterface.bulkInsert('role_permissions', rows);
    }
  },

  async down(queryInterface) {
    for (const t of [
      'certificates', 'notices', 'exam_marks', 'exam_schedules', 'exams', 'biometric_devices', 'attendance', 'holidays',
      'cashbook_entries', 'cashbook_heads', 'fee_payment_items', 'fee_payments', 'fee_concessions', 'fee_structures',
      'fee_installments', 'fee_heads',
    ]) {
      await queryInterface.dropTable(t);
    }
    await queryInterface.removeColumn('students', 'biometric_id');
    await queryInterface.removeColumn('student_enrollments', 'transport_route_id');
    await queryInterface.dropTable('buses');
    await queryInterface.dropTable('transport_routes');
  },
};
