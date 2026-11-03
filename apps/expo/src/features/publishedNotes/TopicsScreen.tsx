import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { loadTopics } from './classTeaching'
import { LetterListScreen } from './studyKit'

/** The topics the classes teach on, A to Z, on Bible Strong's Nave list. */
const TopicsScreen = () => {
  const router = useRouter()
  const rows = useQuery({
    queryKey: ['cyberjudah-topics'],
    queryFn: () => loadTopics(),
    staleTime: 60 * 60 * 1000,
    networkMode: 'always',
    retry: 1,
  })
  const listRows = useMemo(
    () => rows.data?.map(row => ({ key: row.slug, label: row.label })),
    [rows.data]
  )
  return (
    <LetterListScreen
      title="Topics"
      rows={listRows}
      isPending={rows.isPending}
      isError={rows.isError}
      searchPlaceholder="Topic search"
      errorMessage="The topics did not load. Check your connection."
      emptyMessage="No topic found."
      onOpen={slug => router.push({ pathname: '/(explore)/topic', params: { slug } })}
    />
  )
}

export default TopicsScreen
