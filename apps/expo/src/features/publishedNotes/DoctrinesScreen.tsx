import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { loadDoctrines } from './classTeaching'
import { LetterListScreen } from './studyKit'

/** False doctrines, A to Z, on Bible Strong's Nave list. */
const DoctrinesScreen = () => {
  const router = useRouter()
  const rows = useQuery({
    queryKey: ['cyberjudah-doctrines'],
    queryFn: () => loadDoctrines(),
    staleTime: 60 * 60 * 1000,
    networkMode: 'always',
    retry: 1,
  })
  const listRows = useMemo(
    () => rows.data?.map(row => ({ key: row.slug, label: row.name })),
    [rows.data]
  )
  const claims = useMemo(() => new Map(rows.data?.map(r => [r.slug, r.claim])), [rows.data])
  return (
    <LetterListScreen
      title="False Doctrines"
      rows={listRows}
      isPending={rows.isPending}
      isError={rows.isError}
      searchPlaceholder="Search a doctrine"
      errorMessage="The false doctrines did not load. Check your connection."
      emptyMessage="No doctrine found."
      matches={(slug, q) => (claims.get(slug) ?? '').toLowerCase().includes(q)}
      onOpen={slug => router.push({ pathname: '/(explore)/false-doctrine', params: { slug } })}
    />
  )
}

export default DoctrinesScreen
