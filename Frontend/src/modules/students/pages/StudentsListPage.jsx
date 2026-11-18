import { Eye, IdCard, Pencil, Search, Upload, UserPlus } from 'lucide-react';
import { openPdf } from '../../../utils/files';
import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import Avatar from '../../../components/common/Avatar';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import DataTable from '../../../components/common/DataTable';
import PageHeader from '../../../components/common/PageHeader';
import Input from '../../../components/form/Input';
import Select from '../../../components/form/Select';
import { useDebounce } from '../../../hooks/useDebounce';
import { usePermission } from '../../../hooks/usePermission';
import { selectScope } from '../../../store/slices/scopeSlice';
import { useClassOptions } from '../../academic/hooks/useClassOptions';
import { useGetSessionsQuery } from '../../academic/services/academicApi';
import { useGetStudentsQuery } from '../services/studentsApi';

const STATUS_TONE = { studying: 'success', promoted: 'primary', detained: 'warning', left: 'danger' };

export default function StudentsListPage() {
  const navigate = useNavigate();
  const { sessionId, mediumId } = useSelector(selectScope);
  const { data: sessions = [] } = useGetSessionsQuery();
  const [filters, setFilters] = useState({ classId: '', sectionId: '', gender: '', page: 1 });
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search);
  const { classOptions, sectionOptions } = useClassOptions(filters.classId);
  const canCreate = usePermission('students.create');
  const canUpdate = usePermission('students.update');
  const canCards = usePermission('students.certificates');
  const canImport = usePermission('students.import');

  const { data, isFetching } = useGetStudentsQuery({
    page: filters.page,
    limit: 25,
    search: debounced || undefined,
    classId: filters.classId || undefined,
    sectionId: filters.sectionId || undefined,
    gender: filters.gender || undefined,
  });

  const set = (patch) => setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));
  const sessionName = sessions.find((s) => s.id === sessionId)?.name;

  const columns = [
    {
      key: 'student',
      header: 'Student',
      render: (e) => (
        <Link to={`/students/${e.student.id}`} className="flex items-center gap-3 hover:text-primary">
          <Avatar name={e.student.name} photoPath={e.student.photoPath} />
          <div className="min-w-0">
            <p className="truncate font-medium">{e.student.name}</p>
            <p className="text-xs text-muted">{e.student.admissionNo}</p>
          </div>
        </Link>
      ),
    },
    {
      key: 'class',
      header: 'Class',
      render: (e) => (
        <span className="whitespace-nowrap">
          {e.schoolClass.name}
          {e.section ? `-${e.section.name}` : ''}
        </span>
      ),
    },
    { key: 'rollNo', header: 'Roll', className: 'tabular-nums' },
    { key: 'father', header: 'Father', render: (e) => e.student.fatherName ?? '—' },
    { key: 'mobile', header: 'Mobile', render: (e) => e.student.fatherMobile ?? '—', className: 'tabular-nums' },
    !mediumId && { key: 'medium', header: 'Medium', render: (e) => <Badge>{e.medium.name}</Badge> },
    { key: 'status', header: 'Status', render: (e) => <Badge tone={STATUS_TONE[e.status]}>{e.status}</Badge> },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (e) => (
        <div className="flex justify-end gap-2">
          <Button size="icon-sm" icon={Eye} aria-label="View" onClick={() => navigate(`/students/${e.student.id}`)} />
          {canUpdate && <Button size="icon-sm" icon={Pencil} aria-label="Edit" onClick={() => navigate(`/students/${e.student.id}/edit`)} />}
        </div>
      ),
    },
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        title="Students"
        subtitle={`Enrolled in session ${sessionName ?? ''}${data ? ` · ${data.meta.total} students` : ''}`}
        actions={
          <>
            {canCards && (
              <Button
                icon={IdCard}
                disabled={!filters.classId}
                title={filters.classId ? 'ID cards for the filtered class' : 'Choose a class first'}
                onClick={() => openPdf('/students/id-cards/pdf', { classId: filters.classId, sectionId: filters.sectionId || undefined }, 'ID cards')}
              >
                ID cards
              </Button>
            )}
            {canImport && (
              <Button icon={Upload} onClick={() => navigate('/students/import')}>
                Import
              </Button>
            )}
            {canCreate && (
              <Button variant="primary" icon={UserPlus} onClick={() => navigate('/students/new')}>
                New admission
              </Button>
            )}
          </>
        }
      />
      <Card>
        <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            icon={Search}
            placeholder="Name, admission no, father, mobile…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              set({});
            }}
          />
          <Select value={filters.classId} onChange={(e) => set({ classId: e.target.value, sectionId: '' })} placeholder="All classes" options={classOptions} />
          <Select
            value={filters.sectionId}
            onChange={(e) => set({ sectionId: e.target.value })}
            placeholder="All sections"
            options={sectionOptions}
            disabled={!filters.classId}
          />
          <Select
            value={filters.gender}
            onChange={(e) => set({ gender: e.target.value })}
            placeholder="All genders"
            options={[
              { value: 'male', label: 'Boys' },
              { value: 'female', label: 'Girls' },
              { value: 'other', label: 'Other' },
            ]}
          />
        </div>
        <DataTable
          columns={columns}
          rows={data?.items ?? []}
          loading={isFetching && !data}
          meta={data?.meta}
          onPageChange={(page) => set({ page })}
          empty="No students in this session / medium yet"
        />
      </Card>
    </>
  );
}
