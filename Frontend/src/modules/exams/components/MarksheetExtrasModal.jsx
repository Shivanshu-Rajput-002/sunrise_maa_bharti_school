import { FileText, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useGetMarksheetExtrasQuery, useSaveMarksheetExtrasMutation } from '../../../api/opsApi';
import Button from '../../../components/common/Button';
import Loader from '../../../components/common/Loader';
import Modal from '../../../components/common/Modal';
import Input from '../../../components/form/Input';
import { usePermission } from '../../../hooks/usePermission';
import { openPdf } from '../../../utils/files';

const LAYOUT_NAME = {
  primary: 'Hindi medium · Class 1–5',
  secondary: 'Hindi medium · Class 6–10',
  senior: 'Hindi medium · Class 11–12',
  english: 'English medium',
};
const CO_AREAS = [
  ['work', 'Work Education'],
  ['art', 'Art Education'],
  ['health', 'Health & Physical Edu.'],
  ['discipline', 'Discipline'],
];

/** Reads a nested key like "supw.comp" */
const getIn = (o, path) => path.split('.').reduce((v, k) => (v == null ? v : v[k]), o);
const setIn = (o, path, value) => {
  const [k, ...rest] = path.split('.');
  return { ...o, [k]: rest.length ? setIn(o?.[k] ?? {}, rest.join('.'), value) : value };
};

/** Empty strings → removed; numeric fields → numbers */
const clean = (o, numeric) =>
  Object.fromEntries(
    Object.entries(o ?? {})
      .map(([k, v]) => [k, v && typeof v === 'object' ? clean(v, numeric) : v === '' || v == null ? undefined : numeric.has(k) ? Number(v) : v])
      .filter(([, v]) => v !== undefined && !(typeof v === 'object' && !Object.keys(v).length)),
  );
const NUMERIC = new Set(['comp', 'opt', 'camp', 'theory', 'practical', 'assignment', 'based', 'annual', 'totalMeetings', 'attendance']);

function Section({ title, children }) {
  return (
    <fieldset className="rounded-2xl p-4 shadow-neu-in-sm">
      <legend className="px-2 text-sm font-semibold">{title}</legend>
      <div className="grid gap-3 sm:grid-cols-3">{children}</div>
    </fieldset>
  );
}

/** SUPW / Art / Jeevan Kaushal marks, co-scholastic grades, health and remark printed on the marksheet */
export default function MarksheetExtrasModal({ row, onClose }) {
  const { data, isLoading } = useGetMarksheetExtrasQuery(row.enrollmentId);
  const [save, s] = useSaveMarksheetExtrasMutation();
  const [f, setF] = useState({});
  const canEdit = usePermission('exams.marks');

  useEffect(() => {
    if (data) setF(data.data ?? {});
  }, [data]);

  const num = (path, label, max) => (
    <Input label={`${label} (${max})`} type="number" min={0} max={max} step="0.5" disabled={!canEdit} value={getIn(f, path) ?? ''} onChange={(e) => setF(setIn(f, path, e.target.value))} />
  );
  const txt = (path, label, max = 10) => (
    <Input label={label} maxLength={max} disabled={!canEdit} value={getIn(f, path) ?? ''} onChange={(e) => setF(setIn(f, path, e.target.value))} />
  );

  const submit = async (thenPrint) => {
    try {
      await save({ id: row.enrollmentId, ...clean(f, NUMERIC) }).unwrap();
      toast.success('Saved');
      if (thenPrint) openPdf(`/exams/report-card/${row.enrollmentId}/pdf`, undefined, `Marksheet · ${row.student.name}`);
      else onClose();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const layout = data?.layout;
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Marksheet details · ${row.student.name}`}
      footer={
        <>
          <Button onClick={onClose}>Close</Button>
          {canEdit && <Button icon={FileText} loading={s.isLoading} onClick={() => submit(true)}>Save & print</Button>}
          {canEdit && <Button variant="primary" icon={Save} loading={s.isLoading} onClick={() => submit(false)}>Save</Button>}
        </>
      }
    >
      {isLoading || !data ? (
        <Loader />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted">Layout: <span className="font-medium text-ink">{LAYOUT_NAME[layout]}</span>. Marks come from Marks entry; fill only what is printed besides marks.</p>

          {layout === 'secondary' && (
            <>
              <Section title="S.U.P.W">
                {num('supw.comp', 'Compulsory activity', 25)}
                {num('supw.opt', 'Optional activity', 45)}
                {num('supw.camp', 'Camp', 30)}
              </Section>
              <Section title="Art Education">
                {num('art.theory', 'Theory', 25)}
                {num('art.practical', 'Practical', 60)}
                {num('art.assignment', 'Assignment', 15)}
              </Section>
            </>
          )}

          {layout === 'senior' && (
            <Section title="Jeevan Kaushal">
              {num('jeevan.based', 'Based evaluation', 30)}
              {num('jeevan.assignment', 'Assignment', 30)}
              {num('jeevan.annual', 'Annual exam', 40)}
            </Section>
          )}

          {layout === 'english' && (
            <>
              {['t1', 't2'].map((t, i) => (
                <fieldset key={t} className="rounded-2xl p-4 shadow-neu-in-sm">
                  <legend className="px-2 text-sm font-semibold">Term-{i + 1} · co-scholastic grades &amp; health</legend>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {CO_AREAS.map(([k, label]) => <div key={k}>{txt(`coScholastic.${t}.${k}`, label, 5)}</div>)}
                    {txt(`health.${t}.height`, 'Height (cm)')}
                    {txt(`health.${t}.weight`, 'Weight (kg)')}
                  </div>
                </fieldset>
              ))}
              <Input label="Remark" maxLength={300} disabled={!canEdit} value={f.remark ?? ''} onChange={(e) => setF({ ...f, remark: e.target.value })} />
            </>
          )}

          {layout !== 'english' && layout !== 'primary' && (
            <Section title="Attendance (leave empty to use the attendance register)">
              {num('totalMeetings', 'Total meetings', 400)}
              {num('attendance', 'Student attendance', 400)}
            </Section>
          )}
        </div>
      )}
    </Modal>
  );
}
