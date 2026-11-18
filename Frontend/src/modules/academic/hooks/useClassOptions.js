import { useMemo } from 'react';
import { useGetClassesQuery, useGetMediumsQuery } from '../services/academicApi';

/** Dropdown options for class → section, and mediums. Sections depend on the chosen class. */
export function useClassOptions(classId) {
  const { data: classes = [], isLoading } = useGetClassesQuery();
  const { data: mediums = [] } = useGetMediumsQuery();

  return useMemo(() => {
    const cls = classes.find((c) => c.id === Number(classId));
    return {
      isLoading,
      classes,
      classOptions: classes.map((c) => ({ value: c.id, label: c.nameHi ? `${c.name} (${c.nameHi})` : c.name })),
      sectionOptions: (cls?.sections ?? []).filter((s) => s.isActive).map((s) => ({ value: s.id, label: s.name })),
      mediumOptions: mediums.map((m) => ({ value: m.id, label: m.name })),
      mediums,
    };
  }, [classes, mediums, classId, isLoading]);
}
