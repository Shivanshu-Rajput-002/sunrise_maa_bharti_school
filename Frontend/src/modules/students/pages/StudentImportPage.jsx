import { FileDown, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux';
import { baseApi } from '../../../app/store/baseApi';
import Badge from '../../../components/common/Badge';
import Button from '../../../components/common/Button';
import Card from '../../../components/common/Card';
import DataTable from '../../../components/common/DataTable';
import PageHeader from '../../../components/common/PageHeader';
import { selectScope } from '../../../store/slices/scopeSlice';
import { downloadFile, uploadFile } from '../../../utils/files';
import { useGetSessionsQuery } from '../../academic/services/academicApi';

export default function StudentImportPage() {
  const dispatch = useDispatch();
  const { sessionId } = useSelector(selectScope);
  const { data: sessions = [] } = useGetSessionsQuery();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);
  const sessionName = sessions.find((s) => s.id === sessionId)?.name;

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await uploadFile('/students/import', file);
      setResult(res);
      toast.success(`${res.imported} students imported${res.failed ? `, ${res.failed} failed` : ''}`);
      dispatch(baseApi.util.invalidateTags(['Student', 'Dashboard']));
    } catch (err) {
      toast.error(err.message);
    }
    setBusy(false);
  };

  return (
    <>
      <PageHeader title="Import students" subtitle={`Students are admitted into session ${sessionName ?? ''}. Each row is validated like the admission form.`} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="1. Download template">
          <p className="text-sm text-muted">Fill one student per row. The “Help” sheet lists allowed values.</p>
          <Button className="mt-4" icon={FileDown} onClick={() => downloadFile('/students/import/template', 'students-import-template.xlsx')}>Template (.xlsx)</Button>
        </Card>
        <Card title="2. Upload filled file" className="lg:col-span-2">
          <p className="text-sm text-muted">Up to 2000 rows. Rows with errors are skipped and listed below — fix them and upload only those rows again.</p>
          <Button className="mt-4" variant="primary" icon={Upload} loading={busy} onClick={() => fileRef.current?.click()}>Choose .xlsx file</Button>
          <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={onFile} />
        </Card>
      </div>
      {result && (
        <Card className="mt-6" title={`Imported ${result.imported} · Failed ${result.failed}`}>
          <DataTable
            rowKey="row"
            rows={result.results}
            columns={[
              { key: 'row', header: 'Row', className: 'w-16' },
              { key: 'name', header: 'Name' },
              { key: 'status', header: 'Result', render: (r) => <Badge tone={r.status === 'ok' ? 'success' : 'danger'}>{r.status === 'ok' ? 'Imported' : 'Failed'}</Badge> },
              { key: 'detail', header: 'Details', render: (r) => (r.status === 'ok' ? r.admissionNo : <span className="text-danger">{r.error}</span>) },
            ]}
          />
        </Card>
      )}
    </>
  );
}
