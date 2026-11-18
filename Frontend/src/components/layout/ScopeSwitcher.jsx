import { CalendarRange } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux';
import { useGetMediumsQuery, useGetSessionsQuery } from '../../modules/academic/services/academicApi';
import { selectScope, setMedium, setSession } from '../../store/slices/scopeSlice';
import SegmentedControl from '../form/SegmentedControl';

/**
 * Session dropdown + Hindi/English/All medium switch.
 * Changing either resets the API cache, so every screen reloads in the new scope.
 */
export default function ScopeSwitcher() {
  const dispatch = useDispatch();
  const { sessionId, mediumId } = useSelector(selectScope);
  const { data: sessions = [] } = useGetSessionsQuery();
  const { data: mediums = [] } = useGetMediumsQuery();

  const onSession = (e) => {
    const s = sessions.find((x) => x.id === Number(e.target.value));
    dispatch(setSession(e.target.value));
    if (s) toast.success(`Session switched to ${s.name}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="relative flex items-center">
        <span className="sr-only">Academic session</span>
        <CalendarRange className="pointer-events-none absolute left-3 h-4 w-4 text-primary" />
        <select
          value={sessionId ?? ''}
          onChange={onSession}
          className="h-9 appearance-none rounded-xl bg-base pl-9 pr-8 text-sm font-medium text-ink shadow-neu-sm outline-none"
        >
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.isCurrent ? ' (Current)' : ''}
            </option>
          ))}
        </select>
      </label>

      <SegmentedControl
        size="sm"
        ariaLabel="Medium"
        value={mediumId ?? 'all'}
        onChange={(v) => dispatch(setMedium(v))}
        options={[{ value: 'all', label: 'All' }, ...mediums.map((m) => ({ value: m.id, label: m.name }))]}
      />
    </div>
  );
}
