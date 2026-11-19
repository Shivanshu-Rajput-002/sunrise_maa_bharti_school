import { RotateCcw, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useGetRecycleBinQuery, useRestoreStudentMutation } from '../../../api/opsApi';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import DataTable from '../../../components/common/DataTable';
import PageHeader from '../../../components/common/PageHeader';
import { formatDateTime } from '../../../utils/format';

/** Students deleted by mistake can be brought back for 30 days (super admin only) */
export default function RecycleBinPage() {
  const { data = [], isFetching, error } = useGetRecycleBinQuery();
  const [restore, r] = useRestoreStudentMutation();

  return (
    <>
      <PageHeader title="Recycle Bin" subtitle="Students deleted in the last 30 days. Restore brings the student back with all details and parent login link." />
      <Card>
        {error ? (
          <p className="py-8 text-center text-sm text-danger">{error.message}</p>
        ) : (
          <DataTable
            loading={isFetching && !data.length}
            rows={data}
            empty={
              <span className="flex flex-col items-center gap-2">
                <Trash2 className="h-6 w-6" />
                Recycle Bin is empty
              </span>
            }
            columns={[
              { key: 'name', header: 'Student', render: (s) => <span><span className="font-medium">{s.name}</span><span className="block text-xs text-muted">{s.admissionNo}{s.className ? ` · ${s.className}` : ''}</span></span> },
              { key: 'father', header: 'Father', render: (s) => <span>{s.fatherName ?? '—'}<span className="block text-xs text-muted">{s.fatherMobile ?? ''}</span></span> },
              { key: 'when', header: 'Deleted on', render: (s) => <span className="text-xs">{formatDateTime(s.deletedAt)}</span> },
              { key: 'left', header: 'Restore within', render: (s) => <Badge tone={s.daysLeft <= 5 ? 'danger' : 'warning'}>{s.daysLeft} day(s)</Badge> },
              {
                key: 'a',
                header: '',
                className: 'text-right',
                render: (s) => (
                  <Button size="sm" icon={RotateCcw} loading={r.isLoading && r.originalArgs?.id === s.id} onClick={async () => { try { await restore({ id: s.id }).unwrap(); toast.success(`${s.name} restored`); } catch (e) { toast.error(e.message); } }}>
                    Restore
                  </Button>
                ),
              },
            ]}
          />
        )}
      </Card>
    </>
  );
}
