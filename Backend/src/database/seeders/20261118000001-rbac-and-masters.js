'use strict';

/**
 * Seeds: permissions, system roles + their permissions, mediums,
 * a current academic session, and the super admin account.
 * Idempotent — safe to run more than once.
 */
require('dotenv').config();
const bcrypt = require('bcrypt');
const rbac = require('../../common/constants/rbac.json');

function expand(patterns, allKeys) {
  if (patterns === '*') return allKeys;
  return allKeys.filter((k) =>
    patterns.some((p) => p === k || (p.endsWith('.*') && k.startsWith(p.slice(0, -1)))),
  );
}

function currentSessionDates() {
  const now = new Date();
  const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1; // session starts April
  return {
    name: `${startYear}-${startYear + 1}`,
    start_date: `${startYear}-04-01`,
    end_date: `${startYear + 1}-03-31`,
  };
}

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const q = queryInterface.sequelize;

    // Permissions
    const allKeys = Object.entries(rbac.modules).flatMap(([m, actions]) => actions.map((a) => `${m}.${a}`));
    await queryInterface.bulkInsert(
      'permissions',
      allKeys.map((key) => ({ key, module: key.split('.')[0], created_at: now, updated_at: now })),
      { ignoreDuplicates: true },
    );

    // Roles
    await queryInterface.bulkInsert(
      'roles',
      Object.entries(rbac.roles).map(([slug, r]) => ({
        slug,
        name: r.name,
        is_system: true,
        created_at: now,
        updated_at: now,
      })),
      { ignoreDuplicates: true },
    );

    const [perms] = await q.query('SELECT id, `key` FROM permissions');
    const [roles] = await q.query('SELECT id, slug FROM roles');
    const permId = Object.fromEntries(perms.map((p) => [p.key, p.id]));
    const rows = [];
    for (const role of roles) {
      const def = rbac.roles[role.slug];
      if (!def) continue;
      for (const key of expand(def.permissions, allKeys)) rows.push({ role_id: role.id, permission_id: permId[key] });
    }
    if (rows.length) await queryInterface.bulkInsert('role_permissions', rows, { ignoreDuplicates: true });

    // Mediums
    await queryInterface.bulkInsert(
      'mediums',
      [
        { code: 'hi', name: 'Hindi', created_at: now, updated_at: now },
        { code: 'en', name: 'English', created_at: now, updated_at: now },
      ],
      { ignoreDuplicates: true },
    );

    // Current session (only if no sessions exist yet)
    const [[{ c }]] = await q.query('SELECT COUNT(*) c FROM academic_sessions');
    if (Number(c) === 0) {
      await queryInterface.bulkInsert('academic_sessions', [
        { ...currentSessionDates(), is_current: true, created_at: now, updated_at: now },
      ]);
    }

    // Super admin
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD;
    if (!password) throw new Error('Set ADMIN_PASSWORD in .env before seeding');
    const superRole = roles.find((r) => r.slug === 'super_admin');
    await queryInterface.bulkInsert(
      'users',
      [
        {
          name: process.env.ADMIN_NAME || 'Administrator',
          username,
          password_hash: await bcrypt.hash(password, 12),
          role_id: superRole.id,
          is_active: true,
          created_at: now,
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true },
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('users', { username: process.env.ADMIN_USERNAME || 'admin' });
    await queryInterface.bulkDelete('role_permissions', null);
    await queryInterface.bulkDelete('roles', null);
    await queryInterface.bulkDelete('permissions', null);
    await queryInterface.bulkDelete('mediums', null);
  },
};
