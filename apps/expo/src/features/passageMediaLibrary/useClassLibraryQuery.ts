import { useQuery } from '@tanstack/react-query'
import { loadClassLibrary, readCachedClassLibrary } from './cyberJudahClasses'

/** The published classes, read once and shared, to find a class's video from its notes page. */
export const useClassLibraryQuery = (enabled: boolean) =>
  useQuery({
    queryKey: ['cyberjudah-class-library'],
    queryFn: () => loadClassLibrary(),
    initialData: () => readCachedClassLibrary() ?? undefined,
    initialDataUpdatedAt: 0,
    enabled,
    staleTime: 5 * 60 * 1000,
    networkMode: 'always',
    retry: 1,
  })
