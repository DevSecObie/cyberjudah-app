import { useQuery } from '@tanstack/react-query'
import { useAtomValue, useSetAtom } from 'jotai'
import atomWithAsyncStorage from './atomWithAsyncStorage'
import { usesCyberJudahEditorial } from './editorialProfile'
import { RESOURCE_QUERY_GC_TIME } from './queryOptions'
import {
  loadRecordingsCatalog,
  parseRecordingsCatalog,
  type RecordingsCatalog,
} from './recordingsCatalog'

export const RECORDINGS_CATALOG_REFRESH_MS = 5 * 60 * 1000
type CatalogCache = { fetchedAt: number; catalog: RecordingsCatalog }

const readCatalogCache = (value: CatalogCache | null): CatalogCache | null => {
  try {
    return value && Number.isFinite(value.fetchedAt) && value.fetchedAt > 0
      ? { fetchedAt: value.fetchedAt, catalog: parseRecordingsCatalog(value.catalog) }
      : null
  } catch {
    return null
  }
}

export const kjvRecordingsCatalogAtom = atomWithAsyncStorage<CatalogCache | null>(
  'kjvRecordingsCatalog',
  null,
  { migrate: readCatalogCache }
)

/** Refresh while reading; a failed/offline fetch never replaces the last valid local catalog. */
export const useKjvRecordingsCatalog = (enabled: boolean) => {
  const cached = useAtomValue(kjvRecordingsCatalogAtom)
  const setCached = useSetAtom(kjvRecordingsCatalogAtom)
  const query = useQuery({
    queryKey: ['cyberjudah', 'recordings-catalog'],
    queryFn: async ({ signal }) => {
      const catalog = await loadRecordingsCatalog(fetch, signal)
      setCached({ fetchedAt: Date.now(), catalog })
      return catalog
    },
    enabled: enabled && usesCyberJudahEditorial(),
    initialData: cached?.catalog,
    initialDataUpdatedAt: cached?.fetchedAt,
    staleTime: RECORDINGS_CATALOG_REFRESH_MS,
    refetchInterval: RECORDINGS_CATALOG_REFRESH_MS,
    gcTime: RESOURCE_QUERY_GC_TIME,
    networkMode: 'online',
    retry: false,
  })
  return query.data ?? cached?.catalog
}
