import { useSelector } from 'react-redux';
import { selectPermissions } from '../store/slices/authSlice';

/** usePermission('students.view') or usePermission(['a', 'b']) → true if user has ALL */
export function usePermission(required) {
  const perms = useSelector(selectPermissions);
  if (!required) return true;
  const list = Array.isArray(required) ? required : [required];
  return list.every((p) => perms.includes(p));
}

/** Non-hook variant for filtering menus */
export const hasPermission = (perms, required) =>
  !required || (Array.isArray(required) ? required : [required]).every((p) => perms.includes(p));
