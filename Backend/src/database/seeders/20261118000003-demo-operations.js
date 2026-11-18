'use strict';

/**
 * DEMO operations data for the current session (2026-2027): fees, transport, cashbook,
 * attendance, exams, notices, a parent login with two children. Local testing only.
 * Never runs in production; skips if already seeded.
 */
require('dotenv').config({ quiet: true });

let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const ymd = (d) => d.toISOString().slice(0, 10);

module.exports = {
  async up(queryInterface) {
    if (process.env.NODE_ENV === 'production') return;
    const q = queryInterface.sequelize;
    const now = new Date();
    const one = async (sql, rep) => (await q.query(sql, { replacements: rep, type: 'SELECT' }))[0];
    const all = (sql, rep) => q.query(sql, { replacements: rep, type: 'SELECT' });

    const session = await one("SELECT id, start_date FROM academic_sessions WHERE name = '2026-2027'");
    if (!session) return console.log('Run the demo-data seeder first');
    const sid = session.id;
    if ((await one('SELECT COUNT(*) c FROM fee_installments WHERE session_id = ?', [sid])).c > 0) return console.log('Demo operations already present — skipping');

    // ---------- settings ----------
    await q.query(
      `INSERT INTO settings (\`key\`, value, updated_at) VALUES ('school', ?, NOW()) ON DUPLICATE KEY UPDATE value = VALUES(value)`,
      { replacements: [JSON.stringify({ name: 'Sunrise Maa Bharti School', tagline: 'English & Hindi Medium · Nursery to XII', address: 'Main Road, Kota (Raj.) 324001', phone: '0744-2400000', email: 'info@sunriseschool.example', affiliation: 'Affiliated to RBSE, Ajmer', principal: 'Principal', logoPath: null })] },
    );

    // ---------- fee heads & installments (old site: Admission, 1-10 Oct, 1-10 Dec, 1-10 Mar) ----------
    const heads = [['Admission Fee', 'all', 1], ['Tuition Fee', 'all', 2], ['Exam Fee', 'all', 3], ['Hostel Fee', 'hostel', 4]];
    await queryInterface.bulkInsert('fee_heads', heads.map(([name, applies_to, sort_order]) => ({ name, applies_to, sort_order, is_active: true, created_at: now, updated_at: now })), { ignoreDuplicates: true });
    const headRows = await all('SELECT id, name FROM fee_heads');
    const hid = Object.fromEntries(headRows.map((h) => [h.name, h.id]));

    const insts = [['Admission', '2026-04-10', 1], ['1-10 Oct', '2026-10-10', 2], ['1-10 Dec', '2026-12-10', 3], ['1-10 Mar', '2027-03-10', 4]];
    await queryInterface.bulkInsert('fee_installments', insts.map(([name, due_date, sort_order]) => ({ session_id: sid, name, due_date, sort_order, created_at: now, updated_at: now })));
    const instRows = await all('SELECT id, name FROM fee_installments WHERE session_id = ? ORDER BY sort_order', [sid]);

    // ---------- fee structure per class & medium ----------
    const classes = await all('SELECT id, name, sort_order FROM classes ORDER BY sort_order');
    const mediums = await all('SELECT id, code FROM mediums');
    const structure = [];
    for (const c of classes) {
      const base = 6000 + c.sort_order * 900; // yearly tuition grows with class
      for (const m of mediums) {
        const tuition = Math.round((m.code === 'en' ? base * 1.25 : base) / 100) * 100;
        const quarter = Math.round(tuition / 4 / 10) * 10;
        instRows.forEach((inst, i) => {
          if (i === 0) structure.push({ inst: inst.id, head: hid['Admission Fee'], amount: 2000 });
          structure.push({ inst: inst.id, head: hid['Tuition Fee'], amount: i === 3 ? tuition - quarter * 3 : quarter });
          if (i === 1 || i === 3) structure.push({ inst: inst.id, head: hid['Exam Fee'], amount: 300 });
          structure.push({ inst: inst.id, head: hid['Hostel Fee'], amount: 6000 });
        });
        await queryInterface.bulkInsert(
          'fee_structures',
          structure.splice(0).map((s) => ({ session_id: sid, medium_id: m.id, class_id: c.id, installment_id: s.inst, fee_head_id: s.head, amount: s.amount, created_at: now, updated_at: now })),
        );
      }
    }

    // ---------- transport ----------
    const routes = [['Kota City', 6000], ['Bundi Road', 7200], ['Sangod', 9000], ['Ramganj Mandi', 10800], ['Baran Road', 8400]];
    await queryInterface.bulkInsert('transport_routes', routes.map(([name, fee]) => ({ session_id: sid, name, annual_fee: fee, is_active: true, created_at: now, updated_at: now })));
    const routeRows = await all('SELECT id FROM transport_routes WHERE session_id = ?', [sid]);
    await queryInterface.bulkInsert('buses', [
      { bus_no: 'RJ20PA1234', driver_name: 'Ramesh Kumar', driver_mobile: '9829000001', gps_url: 'https://maps.google.com/?q=25.18,75.83', is_active: true, created_at: now, updated_at: now },
      { bus_no: 'RJ20PA5678', driver_name: 'Suresh Meena', driver_mobile: '9829000002', gps_url: 'https://maps.google.com/?q=25.21,75.86', is_active: true, created_at: now, updated_at: now },
    ], { ignoreDuplicates: true });
    const transportEnr = await all('SELECT id FROM student_enrollments WHERE session_id = ? AND uses_transport = 1', [sid]);
    for (const e of transportEnr) await q.query('UPDATE student_enrollments SET transport_route_id = ? WHERE id = ?', { replacements: [pick(routeRows).id, e.id] });

    // ---------- biometric ids ----------
    await q.query("UPDATE students SET biometric_id = CONCAT('B', LPAD(id, 4, '0')) WHERE admission_no LIKE 'DEMO/%'");

    // ---------- payments: ~60% paid the Admission installment ----------
    const enrs = await all('SELECT id, student_id, medium_id, class_id, is_hostel, transport_route_id FROM student_enrollments WHERE session_id = ?', [sid]);
    const routeFee = Object.fromEntries((await all('SELECT id, annual_fee FROM transport_routes WHERE session_id = ?', [sid])).map((r) => [r.id, Number(r.annual_fee)]));
    const admin = await one("SELECT id FROM users WHERE username = ?", [process.env.ADMIN_USERNAME || 'Sunrise']);
    const firstInst = instRows[0].id;
    let receipt = 0;
    for (const e of enrs) {
      if (rnd() > 0.6) continue;
      const lines = await all(
        `SELECT fs.fee_head_id, fs.amount, fh.applies_to FROM fee_structures fs JOIN fee_heads fh ON fh.id = fs.fee_head_id
         WHERE fs.session_id = ? AND fs.class_id = ? AND fs.medium_id = ? AND fs.installment_id = ?`,
        [sid, e.class_id, e.medium_id, firstInst],
      );
      const items = lines.filter((l) => l.applies_to === 'all' || e.is_hostel).map((l) => ({ head: l.fee_head_id, amount: Number(l.amount) }));
      if (e.transport_route_id) items.push({ head: null, amount: Math.floor((routeFee[e.transport_route_id] / instRows.length) * 100) / 100 });
      const gross = items.reduce((n, i) => n + i.amount, 0);
      receipt++;
      const date = ymd(new Date(2026, 3, 5 + Math.floor(rnd() * 25)));
      await queryInterface.bulkInsert('fee_payments', [{
        receipt_no: `R26-${String(receipt).padStart(5, '0')}`, session_id: sid, medium_id: e.medium_id, enrollment_id: e.id, student_id: e.student_id,
        payment_date: date, gross_amount: gross, discount: 0, fine: 0, net_amount: gross, mode: pick(['cash', 'cash', 'upi', 'online']),
        status: 'paid', collected_by: admin.id, created_at: now, updated_at: now,
      }]);
      const p = await one('SELECT id FROM fee_payments WHERE receipt_no = ?', [`R26-${String(receipt).padStart(5, '0')}`]);
      await queryInterface.bulkInsert('fee_payment_items', items.map((i) => ({ payment_id: p.id, installment_id: firstInst, fee_head_id: i.head, amount: i.amount })));
    }
    await q.query('INSERT INTO sequences (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = GREATEST(value, VALUES(value))', { replacements: [`receipt:${sid}`, receipt] });

    // A few concessions (staff ward / sibling)
    for (const e of enrs.slice(0, 6)) {
      await queryInterface.bulkInsert('fee_concessions', [{ enrollment_id: e.id, type: e.id % 2 ? 'percent' : 'fixed', value: e.id % 2 ? 25 : 1500, reason: e.id % 2 ? 'Staff ward' : 'Sibling concession', created_at: now, updated_at: now }]);
    }

    // ---------- cashbook ----------
    const cbHeads = [['Electricity', 'expense'], ['Salary', 'expense'], ['Stationery', 'expense'], ['Maintenance', 'expense'], ['Bus Diesel', 'expense'], ['Donation', 'income'], ['Uniform Sale', 'income'], ['Book Sale', 'income']];
    await queryInterface.bulkInsert('cashbook_heads', cbHeads.map(([name, type]) => ({ name, type, is_active: true, created_at: now, updated_at: now })), { ignoreDuplicates: true });
    const cb = await all('SELECT id, type, name FROM cashbook_heads');
    const entries = [];
    for (let i = 0; i < 40; i++) {
      const h = pick(cb);
      entries.push({ session_id: sid, head_id: h.id, entry_date: ymd(new Date(2026, 3 + Math.floor(rnd() * 7), 1 + Math.floor(rnd() * 27))), type: h.type, amount: Math.round((h.name === 'Salary' ? 40000 : 500 + rnd() * 8000) / 10) * 10, party: h.type === 'expense' ? pick(['JVVNL', 'Staff', 'Gupta Stationers', 'Sharma Electricals', 'HP Petrol Pump']) : pick(['Parents', 'Trust', 'Walk-in']), mode: pick(['cash', 'bank', 'upi']), remarks: null, created_by: admin.id, created_at: now, updated_at: now });
    }
    await queryInterface.bulkInsert('cashbook_entries', entries);

    // ---------- holidays & attendance (last 15 days up to today) ----------
    const holidays = [['2026-08-15', 'Independence Day'], ['2026-10-02', 'Gandhi Jayanti'], ['2026-11-08', 'Diwali'], ['2026-11-09', 'Govardhan Puja'], ['2027-01-26', 'Republic Day']];
    await queryInterface.bulkInsert('holidays', holidays.map(([date, title]) => ({ session_id: sid, date, title, created_at: now, updated_at: now })));
    const holidaySet = new Set(holidays.map((h) => h[0]));
    const att = [];
    for (let back = 15; back >= 0; back--) {
      const d = new Date(now);
      d.setDate(d.getDate() - back);
      const day = ymd(d);
      if (d.getDay() === 0 || holidaySet.has(day) || day < session.start_date) continue;
      for (const e of enrs) {
        const r = rnd();
        att.push({ session_id: sid, enrollment_id: e.id, date: day, status: r < 0.87 ? 'P' : r < 0.95 ? 'A' : r < 0.98 ? 'L' : 'HD', source: 'manual', marked_by: admin.id, created_at: now, updated_at: now });
      }
    }
    for (let i = 0; i < att.length; i += 1000) await queryInterface.bulkInsert('attendance', att.slice(i, i + 1000));

    // ---------- exams ----------
    await queryInterface.bulkInsert('exams', [
      { session_id: sid, name: 'Unit Test 1', type: 'unit_test', start_date: '2026-07-20', end_date: '2026-07-25', include_in_report: true, is_published: true, created_at: now, updated_at: now },
      { session_id: sid, name: 'Half Yearly', type: 'term', start_date: '2026-12-14', end_date: '2026-12-22', include_in_report: true, is_published: false, created_at: now, updated_at: now },
    ]);
    const exams = await all('SELECT id, name FROM exams WHERE session_id = ? ORDER BY id', [sid]);
    const subjects = Object.fromEntries((await all('SELECT id, name FROM subjects')).map((s) => [s.name, s.id]));
    const core = ['Hindi', 'English', 'Mathematics', 'Science', 'Social Science'];
    for (const ex of exams) {
      const isUnit = ex.name.startsWith('Unit');
      const scheduleRows = [];
      for (const c of classes.filter((x) => x.sort_order <= 15)) {
        core.forEach((sub, i) => {
          const date = new Date(isUnit ? '2026-07-20' : '2026-12-14');
          date.setDate(date.getDate() + i);
          scheduleRows.push({ exam_id: ex.id, class_id: c.id, subject_id: subjects[sub], exam_date: ymd(date), start_time: '09:00:00', end_time: isUnit ? '10:30:00' : '12:00:00', max_marks: isUnit ? 25 : 80, pass_marks: isUnit ? 9 : 27, created_at: now, updated_at: now });
        });
      }
      await queryInterface.bulkInsert('exam_schedules', scheduleRows);
    }
    // Marks for the (published) unit test
    const unit = exams[0];
    const sch = await all('SELECT id, class_id, max_marks FROM exam_schedules WHERE exam_id = ?', [unit.id]);
    const marks = [];
    for (const s of sch) {
      for (const e of enrs.filter((x) => x.class_id === s.class_id)) {
        const absent = rnd() < 0.02;
        marks.push({ schedule_id: s.id, enrollment_id: e.id, marks: absent ? null : Math.round((0.35 + rnd() * 0.65) * Number(s.max_marks)), is_absent: absent, entered_by: admin.id, created_at: now, updated_at: now });
      }
    }
    for (let i = 0; i < marks.length; i += 1000) await queryInterface.bulkInsert('exam_marks', marks.slice(i, i + 1000));

    // ---------- notices ----------
    await queryInterface.bulkInsert('notices', [
      { session_id: sid, title: 'Half Yearly exams from 14 December', body: 'Half yearly examinations will begin on 14 December. Admit cards will be available in the parent portal.', audience: 'all', publish_from: ymd(new Date(now.getTime() - 3 * 864e5)), publish_to: '2026-12-22', created_by: admin.id, created_at: now, updated_at: now },
      { session_id: sid, title: 'Second installment due by 10 October', body: 'Please clear the second installment to avoid late fee.', audience: 'parents', publish_from: '2026-10-01', publish_to: null, created_by: admin.id, created_at: now, updated_at: now },
      { session_id: sid, title: 'Staff meeting on Saturday', body: 'All teachers to attend the staff meeting at 2 PM.', audience: 'staff', publish_from: ymd(now), publish_to: null, created_by: admin.id, created_at: now, updated_at: now },
    ]);

    // ---------- parent login: demo_parent gets two children ----------
    const parent = await one("SELECT id FROM users WHERE username = 'demo_parent'");
    if (parent) {
      await q.query("UPDATE students SET parent_user_id = ? WHERE admission_no IN ('DEMO/0001', 'DEMO/0013')", { replacements: [parent.id] });
    }
    console.log(`Demo operations: ${receipt} receipts, ${att.length} attendance marks, ${marks.length} exam marks`);
  },

  async down(queryInterface) {
    const q = queryInterface.sequelize;
    const [[s]] = await q.query("SELECT id FROM academic_sessions WHERE name = '2026-2027'");
    if (!s) return;
    for (const t of ['notices', 'exams', 'attendance', 'holidays', 'cashbook_entries', 'fee_payments', 'fee_installments', 'transport_routes']) {
      await q.query(`DELETE FROM ${t} WHERE session_id = ?`, { replacements: [s.id] });
    }
  },
};
