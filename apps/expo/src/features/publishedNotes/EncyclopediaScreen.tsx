import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { loadEncyclopedia, readCachedEncyclopedia } from './publishedNotes'
import { LetterListScreen } from './studyKit'

/** The Encyclopedia, A to Z, on Bible Strong's Dictionary list. */
const EncyclopediaScreen = () => {
  const router = useRouter()
  const rows = useQuery({
    queryKey: ['cyberjudah-encyclopedia'],
    queryFn: () => loadEncyclopedia(),
    initialData: readCachedEncyclopedia() ?? undefined,
    staleTime: 60 * 60 * 1000,
    networkMode: 'always',
    retry: 1,
  })
  const listRows = useMemo(
    () => rows.data?.map(row => ({ key: row.url, label: row.title })),
    [rows.data]
  )
  const summaries = useMemo(() => new Map(rows.data?.map(r => [r.url, r.summary])), [rows.data])
  return (
    <LetterListScreen
      title="Encyclopedia"
      rows={listRows}
      isPending={rows.isPending}
      isError={rows.isError}
      searchPlaceholder="Word search"
      errorMessage="The Encyclopedia did not load. Check your connection."
      emptyMessage="No entry found."
      matches={(url, q) => (summaries.get(url) ?? '').toLowerCase().includes(q)}
      onOpen={path => router.push({ pathname: '/(explore)/published-note', params: { path } })}
    />
  )
}

export default EncyclopediaScreen
