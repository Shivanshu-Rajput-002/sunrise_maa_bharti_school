'use strict';

/**
 * Phase 1 — foundation schema.
 * Academic master data, RBAC, users, auth tokens, audit log, settings.
 * All tables InnoDB + utf8mb4. Every FK column is indexed.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { INTEGER, STRING, BOOLEAN, DATE, DATEONLY, JSON, ENUM, TINYINT, BIGINT, fn } = Sequelize;
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

    // ---------- Academic master ----------
    await queryInterface.createTable('academic_sessions', {
      id: pk,
      name: { type: STRING(20), allowNull: false, unique: true }, // e.g. 2026-2027
      start_date: { type: DATEONLY, allowNull: false },
      end_date: { type: DATEONLY, allowNull: false },
      is_current: { type: BOOLEAN, allowNull: false, defaultValue: false },
      is_active: { type: BOOLEAN, allowNull: false, defaultValue: true },
      ...ts,
    });
    await queryInterface.addIndex('academic_sessions', ['is_current']);

    await queryInterface.createTable('mediums', {
      id: { type: TINYINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      code: { type: STRING(5), allowNull: false, unique: true }, // hi / en
      name: { type: STRING(30), allowNull: false },
      is_active: { type: BOOLEAN, allowNull: false, defaultValue: true },
      ...ts,
    });

    await queryInterface.createTable('classes', {
      id: pk,
      name: { type: STRING(30), allowNull: false, unique: true }, // English label: NUR, 1, 11A
      name_hi: { type: STRING(30), allowNull: true }, // Hindi/roman label: PP+3, I, XIA
      class_group: {
        type: ENUM('preprimary', 'primary', 'upperprimary', 'secondary', 'highsecondary', 'staff'),
        allowNull: false,
      },
      sort_order: { type: INTEGER, allowNull: false, defaultValue: 0 },
      next_class_id: { ...fk('classes', 'SET NULL'), allowNull: true }, // promotion target
      is_active: { type: BOOLEAN, allowNull: false, defaultValue: true },
      legacy_id: { type: INTEGER, allowNull: true, unique: true },
      ...ts,
    });
    await queryInterface.addIndex('classes', ['is_active', 'sort_order']);
    await queryInterface.addIndex('classes', ['next_class_id']);

    await queryInterface.createTable('sections', {
      id: pk,
      class_id: { ...fk('classes', 'CASCADE'), allowNull: false },
      name: { type: STRING(10), allowNull: false },
      is_active: { type: BOOLEAN, allowNull: false, defaultValue: true },
      ...ts,
    });
    await queryInterface.addIndex('sections', ['class_id', 'name'], { unique: true });

    await queryInterface.createTable('subjects', {
      id: pk,
      name: { type: STRING(100), allowNull: false, unique: true },
      code: { type: STRING(20), allowNull: true, unique: true },
      is_active: { type: BOOLEAN, allowNull: false, defaultValue: true },
      legacy_id: { type: INTEGER, allowNull: true, unique: true },
      ...ts,
    });

    // ---------- RBAC ----------
    await queryInterface.createTable('roles', {
      id: pk,
      name: { type: STRING(50), allowNull: false },
      slug: { type: STRING(50), allowNull: false, unique: true },
      is_system: { type: BOOLEAN, allowNull: false, defaultValue: false }, // cannot be deleted
      ...ts,
    });

    await queryInterface.createTable('permissions', {
      id: pk,
      key: { type: STRING(80), allowNull: false, unique: true }, // students.view
      module: { type: STRING(40), allowNull: false },
      description: { type: STRING(150), allowNull: true },
      ...ts,
    });
    await queryInterface.addIndex('permissions', ['module']);

    await queryInterface.createTable('role_permissions', {
      role_id: { ...fk('roles', 'CASCADE'), allowNull: false, primaryKey: true },
      permission_id: { ...fk('permissions', 'CASCADE'), allowNull: false, primaryKey: true },
    });
    await queryInterface.addIndex('role_permissions', ['permission_id']);

    // ---------- Users & auth ----------
    await queryInterface.createTable('users', {
      id: pk,
      name: { type: STRING(120), allowNull: false },
      username: { type: STRING(80), allowNull: false, unique: true },
      email: { type: STRING(150), allowNull: true, unique: true },
      mobile: { type: STRING(15), allowNull: true },
      password_hash: { type: STRING(100), allowNull: false },
      role_id: { ...fk('roles'), allowNull: false },
      is_active: { type: BOOLEAN, allowNull: false, defaultValue: true },
      last_login_at: { type: DATE, allowNull: true },
      legacy_id: { type: INTEGER, allowNull: true, unique: true }, // Joomla ff6ou_users.id
      ...ts,
      deleted_at: { type: DATE, allowNull: true },
    });
    await queryInterface.addIndex('users', ['role_id', 'is_active']);
    await queryInterface.addIndex('users', ['mobile']);

    await queryInterface.createTable('refresh_tokens', {
      id: { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      user_id: { ...fk('users', 'CASCADE'), allowNull: false },
      token_hash: { type: STRING(64), allowNull: false, unique: true }, // sha256
      expires_at: { type: DATE, allowNull: false },
      revoked_at: { type: DATE, allowNull: true },
      ip: { type: STRING(45), allowNull: true },
      user_agent: { type: STRING(255), allowNull: true },
      created_at: { type: DATE, allowNull: false, defaultValue: fn('NOW') },
    });
    await queryInterface.addIndex('refresh_tokens', ['user_id']);
    await queryInterface.addIndex('refresh_tokens', ['expires_at']);

    // ---------- Audit & settings ----------
    await queryInterface.createTable('audit_logs', {
      id: { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      user_id: { ...fk('users', 'SET NULL'), allowNull: true },
      session_id: { ...fk('academic_sessions', 'SET NULL'), allowNull: true },
      action: { type: STRING(40), allowNull: false }, // create / update / delete / login
      entity: { type: STRING(60), allowNull: false },
      entity_id: { type: STRING(40), allowNull: true },
      meta: { type: JSON, allowNull: true },
      ip: { type: STRING(45), allowNull: true },
      created_at: { type: DATE, allowNull: false, defaultValue: fn('NOW') },
    });
    await queryInterface.addIndex('audit_logs', ['entity', 'entity_id']);
    await queryInterface.addIndex('audit_logs', ['user_id', 'created_at']);
    await queryInterface.addIndex('audit_logs', ['created_at']);

    await queryInterface.createTable('settings', {
      key: { type: STRING(80), primaryKey: true },
      value: { type: JSON, allowNull: true },
      updated_at: { type: DATE, allowNull: false, defaultValue: fn('NOW') },
    });
  },

  async down(queryInterface) {
    for (const t of [
      'settings',
      'audit_logs',
      'refresh_tokens',
      'users',
      'role_permissions',
      'permissions',
      'roles',
      'subjects',
      'sections',
      'classes',
      'mediums',
      'academic_sessions',
    ]) {
      await queryInterface.dropTable(t);
    }
  },
};
