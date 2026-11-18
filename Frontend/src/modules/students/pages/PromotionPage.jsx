import { ArrowRight, ArrowUpCircle, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useSelector } from 'react-redux';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import DataTable from '../../../components/common/DataTable';
import PageHeader from '../../../components/common/PageHeader';
import Select from '../../../components/form/Select';
import { selectScope } from '../../../store/slices/scopeSlice';
import { useClassOptions } from '../../academic/hooks/useClassOptions';
import { useGetSessionsQuery } from '../../academic/services/academicApi';
import { useGetStudentsQuery, usePromoteStudentsMutation } from '../services/studentsApi';

export default function PromotionPage() {
  const scope = useSelector(selectScope);
  const { data: sessions = [] } = useGetSessionsQuery();
  const current = sessions.find((s) => s.id === scope.sessionId);
  const laterSessions = sessions.filter((s) => current && s.startDate > current.startDate);

  const [src, setSrc] = useState({ classId: '', sectionId: '', mediumId: scope.mediumId ?? '' });
  const [dst, setDst] = useState({ sessionId: '', classId: '', sectionId: '' });
  const [selected, setSelected] = useState(new Set());
  const [action, setAction] = useState(null); // 'promote' | 'detain'
  const srcOpts = useClassOptions(src.classId);
  const dstOpts = useClassOptions(dst.classId);
  const [promote, { isLoading }] = usePromoteStudentsMutation();

  const ready = src.classId && src.mediumId;
  const { data, isFetching } = useGetStudentsQuery(
    { mediumId: src.mediumId, classId: src.classId, sectionId: src.sectionId || undefined, limit: 200, enrollmentStatus: 'studying', sortBy: 'name' },
    { skip: !ready },
  );
  const rows = useMemo(() => data?.items ?? [], [data]);

  // Select everyone by default; suggest the configured next class
  useEffect(() => setSelected(new Set(rows.map((r) => r.id))), [rows]);
  useEffect(() => {
    const cls = srcOpts.classes.find((c) => c.id === Number(src.classId));
    setDst((d) => ({ ...d, classId: cls?.nextClass ? String(cls.nextClass.id) : '', sectionId: '' }));
  }, [src.classId, srcOpts.classes]);
  useEffect(() => {
    if (!dst.sessionId && laterSessions.length) setDst((d) => ({ ...d, sessionId: String(laterSessions[laterSessions.length - 1].id) }));
  }, [laterSessions, dst.sessionId]);

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const allOn = rows.length > 0 && selected.size === rows.length;

  const run = async () => {
    const detain = action === 'detain';
    try {
      const res = await promote({
        toSessionId: Number(dst.sessionId),
        toClassId: detain ? Number(src.classId) : Number(dst.classId),
        toSectionId: detain ? (src.sectionId ? Number(src.sectionId) : null) : dst.sectionId ? Number(dst.sectionId) : null,
        enrollmentIds: [...selected],
        detain,
      }).unwrap();
      toast.success(`${res.moved} students ${detain ? 'detained' : 'promoted'}${res.skipped ? `, ${res.skipped} already enrolled` : ''}`);
    } catch (e) {
      toast.error(e.message);
    }
    setAction(null);
  };

  const targetSession = sessions.find((s) => s.id === Number(dst.sessionId));
  const canRun = selected.size > 0 && dst.sessionId;

  return (
    <>
      <PageHeader
        title="Promotion"
        subtitle={`Move students from ${current?.name ?? 'this session'} into the next session. Past records stay unchanged.`}
      />

      {!laterSessions.length && (
        <Card className="mb-6">
          <p className="text-sm text-warning">Create the next academic session first (Academic → Sessions), then come back here.</p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_auto_1fr]">
        <Card title={`From · ${current?.name ?? ''}`}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Select label="Medium" value={src.mediumId} onChange={(e) => setSrc({ ...src, mediumId: e.target.value })} placeholder="Select" options={srcOpts.mediumOptions} />
            <Select label="Class" value={src.classId} onChange={(e) => setSrc({ ...src, classId: e.target.value, sectionId: '' })} placeholder="Select" options={srcOpts.classOptions} />
            <Select label="Section" value={src.sectionId} onChange={(e) => setSrc({ ...src, sectionId: e.target.value })} placeholder="All" options={srcOpts.sectionOptions} disabled={!src.classId} />
          </div>
        </Card>
        <div className="hidden items-center lg:flex">
          <ArrowRight className="h-6 w-6 text-muted" />
        </div>
        <Card title={`To · ${targetSession?.name ?? '—'}`}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Select
              label="Session"
              value={dst.sessionId}
              onChange={(e) => setDst({ ...dst, sessionId: e.target.value })}
              placeholder="Select"
              options={laterSessions.map((s) => ({ value: s.id, label: s.name }))}
            />
            <Select label="Class" value={dst.classId} onChange={(e) => setDst({ ...dst, classId: e.target.value, sectionId: '' })} placeholder="Select" options={dstOpts.classOptions} />
            <Select label="Section" value={dst.sectionId} onChange={(e) => setDst({ ...dst, sectionId: e.target.value })} placeholder="None" options={dstOpts.sectionOptions} disabled={!dst.classId} />
          </div>
        </Card>
      </div>

      {ready && (
        <Card
          className="mt-6"
          title="Students"
          subtitle={`${selected.size} of ${rows.length} selected`}
          actions={
            <>
              <Button icon={RotateCcw} disabled={!canRun} onClick={() => setAction('detain')}>
                Detain (repeat class)
              </Button>
              <Button variant="primary" icon={ArrowUpCircle} disabled={!canRun || !dst.classId} onClick={() => setAction('promote')}>
                Promote
              </Button>
            </>
          }
        >
          <DataTable
            loading={isFetching}
            rows={rows}
            columns={[
              {
                key: 'pick',
                header: (
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={allOn}
                    onChange={() => setSelected(allOn ? new Set() : new Set(rows.map((r) => r.id)))}
                    className="h-4 w-4 accent-[rgb(var(--primary))]"
                  />
                ),
                className: 'w-10',
                render: (e) => (
                  <input
                    type="checkbox"
                    aria-label={`Select ${e.student.name}`}
                    checked={selected.has(e.id)}
                    onChange={() => toggle(e.id)}
                    className="h-4 w-4 accent-[rgb(var(--primary))]"
                  />
                ),
              },
              { key: 'roll', header: 'Roll', render: (e) => e.rollNo ?? '—' },
              { key: 'name', header: 'Student', render: (e) => e.student.name },
              { key: 'adm', header: 'Admission no.', render: (e) => e.student.admissionNo },
              { key: 'sec', header: 'Section', render: (e) => e.section?.name ?? '—' },
            ]}
            empty="No studying students in this class"
          />
        </Card>
      )}

      <ConfirmDialog
        open={!!action}
        title={action === 'detain' ? 'Detain selected students?' : 'Promote selected students?'}
        message={
          action === 'detain'
            ? `${selected.size} students will repeat the same class in ${targetSession?.name}.`
            : `${selected.size} students will be enrolled in ${dstOpts.classOptions.find((c) => String(c.value) === dst.classId)?.label ?? ''} for ${targetSession?.name}.`
        }
        confirmText={action === 'detain' ? 'Detain' : 'Promote'}
        loading={isLoading}
        onConfirm={run}
        onClose={() => setAction(null)}
      />
    </>
  );
}
