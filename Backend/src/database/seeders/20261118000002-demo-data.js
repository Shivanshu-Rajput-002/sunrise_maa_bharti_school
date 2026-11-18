'use strict';

/**
 * DEMO DATA for local testing — classes, sections, subjects, sessions, one user per role
 * and ~180 dummy students across two sessions and both mediums (with promotion history).
 * Never runs when NODE_ENV=production. Idempotent: skips if demo students already exist.
 */
require('dotenv').config({ quiet: true });
const bcrypt = require('bcrypt');

const CLASSES = [
  ['NUR', 'PP+3', 'preprimary'], ['LKG', 'PP+4', 'preprimary'], ['UKG', 'PP+5', 'preprimary'],
  ['1', 'I', 'primary'], ['2', 'II', 'primary'], ['3', 'III', 'primary'], ['4', 'IV', 'primary'], ['5', 'V', 'primary'],
  ['6', 'VI', 'upperprimary'], ['7', 'VII', 'upperprimary'], ['8', 'VIII', 'upperprimary'],
  ['9', 'IX', 'secondary'], ['10', 'X', 'secondary'],
  ['11 Science', 'XI Science', 'highsecondary'], ['11 Arts', 'XI Arts', 'highsecondary'],
  ['12 Science', 'XII Science', 'highsecondary'], ['12 Arts', 'XII Arts', 'highsecondary'],
];

const SUBJECTS = [
  ['Hindi', 'HIN'], ['English', 'ENG'], ['Mathematics', 'MAT'], ['Science', 'SCI'], ['Social Science', 'SST'],
  ['Sanskrit', 'SAN'], ['Computer', 'COMP'], ['Physics', 'PHY'], ['Chemistry', 'CHE'], ['Biology', 'BIO'],
  ['History', 'HIS'], ['Geography', 'GEO'], ['Political Science', 'POL'], ['Drawing', 'DRW'], ['Physical Education', 'PE'],
];

const FIRST_M = ['Aarav', 'Vivaan', 'Aditya', 'Arjun', 'Rohan', 'Kunal', 'Yash', 'Harsh', 'Dev', 'Kartik', 'Manish', 'Rahul', 'Sahil', 'Tushar', 'Ankit', 'Deepak'];
const FIRST_F = ['Ananya', 'Diya', 'Isha', 'Kavya', 'Riya', 'Pooja', 'Neha', 'Sneha', 'Priya', 'Anjali', 'Khushi', 'Muskan', 'Sakshi', 'Tanvi', 'Komal', 'Nisha'];
const LAST = ['Sharma', 'Verma', 'Jat', 'Meena', 'Gupta', 'Agarwal', 'Yadav', 'Choudhary', 'Saini', 'Gurjar', 'Joshi', 'Dhaker', 'Mali', 'Prajapat'];
const FATHER = ['Ramesh', 'Suresh', 'Mahesh', 'Rajesh', 'Mukesh', 'Dinesh', 'Kamlesh', 'Prakash', 'Ashok', 'Vinod', 'Sanjay', 'Raju'];
const MOTHER = ['Sunita', 'Kamla', 'Geeta', 'Meena', 'Rekha', 'Savita', 'Pushpa', 'Usha', 'Anita', 'Seema'];
const CITIES = ['Kota', 'Bundi', 'Baran', 'Jhalawar', 'Sangod', 'Ramganj Mandi'];
const CATS = ['GEN', 'OBC', 'OBC', 'OBC', 'SC', 'ST', 'GEN'];

// Deterministic pseudo-random so every run produces the same demo set
let seed = 42;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

module.exports = {
  async up(queryInterface) {
    if (process.env.NODE_ENV === 'production') {
      console.log('Skipping demo data in production');
      return;
    }
    const q = queryInterface.sequelize;
    const now = new Date();
    const [[{ c: existing }]] = await q.query("SELECT COUNT(*) c FROM students WHERE admission_no LIKE 'DEMO/%'");
    if (Number(existing) > 0) {
      console.log('Demo data already present — skipping');
      return;
    }

    // ---------- Sessions ----------
    for (const [name, start, end, current] of [
      ['2025-2026', '2025-04-01', '2026-03-31', false],
      ['2026-2027', '2026-04-01', '2027-03-31', true],
    ]) {
      await q.query(
        'INSERT INTO academic_sessions (name, start_date, end_date, is_current, is_active, created_at, updated_at) VALUES (?,?,?,?,1,NOW(),NOW()) ON DUPLICATE KEY UPDATE name = name',
        { replacements: [name, start, end, current] },
      );
    }
    await q.query("UPDATE academic_sessions SET is_current = (name = '2026-2027')");
    const [sessions] = await q.query('SELECT id, name FROM academic_sessions');
    const sid = Object.fromEntries(sessions.map((s) => [s.name, s.id]));

    // ---------- Classes, sections, subjects ----------
    await queryInterface.bulkInsert(
      'classes',
      CLASSES.map(([name, nameHi, group], i) => ({ name, name_hi: nameHi, class_group: group, sort_order: i + 1, is_active: true, created_at: now, updated_at: now })),
      { ignoreDuplicates: true },
    );
    const [classes] = await q.query('SELECT id, name, sort_order FROM classes ORDER BY sort_order');
    const cid = Object.fromEntries(classes.map((c) => [c.name, c.id]));
    // Promotion chain
    const chain = [['NUR', 'LKG'], ['LKG', 'UKG'], ['UKG', '1'], ['1', '2'], ['2', '3'], ['3', '4'], ['4', '5'], ['5', '6'], ['6', '7'], ['7', '8'], ['8', '9'], ['9', '10'], ['10', '11 Science'], ['11 Science', '12 Science'], ['11 Arts', '12 Arts']];
    for (const [from, to] of chain) await q.query('UPDATE classes SET next_class_id = ? WHERE id = ?', { replacements: [cid[to], cid[from]] });

    const sectionRows = [];
    for (const c of classes) for (const s of ['A', 'B']) sectionRows.push({ class_id: c.id, name: s, is_active: true, created_at: now, updated_at: now });
    await queryInterface.bulkInsert('sections', sectionRows, { ignoreDuplicates: true });
    const [sections] = await q.query('SELECT id, class_id, name FROM sections');
    const secOf = (classId, name) => sections.find((s) => s.class_id === classId && s.name === name)?.id ?? null;

    await queryInterface.bulkInsert(
      'subjects',
      SUBJECTS.map(([name, code]) => ({ name, code, is_active: true, created_at: now, updated_at: now })),
      { ignoreDuplicates: true },
    );

    // ---------- One demo user per role (password: Demo@123) ----------
    const [roles] = await q.query('SELECT id, slug, name FROM roles');
    const hash = await bcrypt.hash('Demo@123', 12);
    await queryInterface.bulkInsert(
      'users',
      roles
        .filter((r) => r.slug !== 'super_admin')
        .map((r) => ({ name: `Demo ${r.name}`, username: `demo_${r.slug}`, password_hash: hash, role_id: r.id, is_active: true, created_at: now, updated_at: now })),
      { ignoreDuplicates: true },
    );

    // ---------- Students ----------
    const [mediums] = await q.query('SELECT id, code FROM mediums');
    const mid = Object.fromEntries(mediums.map((m) => [m.code, m.id]));
    const demoClasses = ['NUR', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11 Science', '11 Arts'];

    const students = [];
    const plan = []; // [index, classNamePrev, medium, section]
    let n = 0;
    for (const cls of demoClasses) {
      for (const medium of ['hi', 'en']) {
        const count = medium === 'hi' ? 7 : 5;
        for (let i = 0; i < count; i++) {
          n++;
          const gender = rnd() < 0.5 ? 'male' : 'female';
          const last = pick(LAST);
          const age = 3 + classes.find((c) => c.name === cls).sort_order;
          students.push({
            admission_no: `DEMO/${String(n).padStart(4, '0')}`,
            admission_date: `${2025 - Math.floor(rnd() * 3)}-04-${String(1 + Math.floor(rnd() * 20)).padStart(2, '0')}`,
            name: `${pick(gender === 'male' ? FIRST_M : FIRST_F)} ${last}`,
            gender,
            dob: `${2026 - age}-${String(1 + Math.floor(rnd() * 12)).padStart(2, '0')}-${String(1 + Math.floor(rnd() * 28)).padStart(2, '0')}`,
            category: pick(CATS),
            religion: 'Hindu',
            father_name: `${pick(FATHER)} ${last}`,
            mother_name: `${pick(MOTHER)} ${last}`,
            father_mobile: `9${String(Math.floor(rnd() * 1e9)).padStart(9, '0')}`,
            city: pick(CITIES),
            address: `Ward ${1 + Math.floor(rnd() * 30)}, ${pick(CITIES)}`,
            pincode: '3240' + String(10 + Math.floor(rnd() * 89)),
            status: 'active',
            created_at: now,
            updated_at: now,
          });
          plan.push({ cls, medium, section: i % 2 === 0 ? 'A' : 'B', newAdmission: rnd() < 0.15 });
        }
      }
    }
    await queryInterface.bulkInsert('students', students);
    const [studentRows] = await q.query("SELECT id, admission_no FROM students WHERE admission_no LIKE 'DEMO/%' ORDER BY admission_no");

    // Previous session (2025-26) in class X, promoted into class X+1 for 2026-27 — except new admissions
    const nextOf = Object.fromEntries(chain);
    const enrollments = [];
    const rollCounter = {};
    const roll = (key) => (rollCounter[key] = (rollCounter[key] || 0) + 1);
    studentRows.forEach((s, i) => {
      const p = plan[i];
      const curClass = nextOf[p.cls] ?? p.cls;
      const curSec = secOf(cid[curClass], p.section);
      const prevSec = secOf(cid[p.cls], p.section);
      if (!p.newAdmission) {
        enrollments.push({
          student_id: s.id, session_id: sid['2025-2026'], medium_id: mid[p.medium], class_id: cid[p.cls], section_id: prevSec,
          roll_no: roll(`prev-${p.medium}-${p.cls}-${p.section}`), enrollment_type: 'new', status: 'promoted',
          is_hostel: false, uses_transport: rnd() < 0.3, created_at: now, updated_at: now,
        });
      }
      enrollments.push({
        student_id: s.id, session_id: sid['2026-2027'], medium_id: mid[p.medium], class_id: cid[curClass], section_id: curSec,
        roll_no: roll(`cur-${p.medium}-${curClass}-${p.section}`), enrollment_type: p.newAdmission ? 'new' : 'promoted', status: 'studying',
        is_hostel: rnd() < 0.08, uses_transport: rnd() < 0.3, created_at: now, updated_at: now,
      });
    });
    await queryInterface.bulkInsert('student_enrollments', enrollments);
    console.log(`Demo: ${studentRows.length} students, ${enrollments.length} enrollments`);
  },

  async down(queryInterface) {
    const q = queryInterface.sequelize;
    await q.query("DELETE FROM students WHERE admission_no LIKE 'DEMO/%'");
    await q.query("DELETE FROM users WHERE username LIKE 'demo\\_%'");
  },
};
