import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { LetterListScreen } from '~features/publishedNotes/studyKit'
import { loadPreceptIndex } from './preceptsAndLaw'

/** The precepts A to Z, on Bible Strong's Lexicon list. */
export default function PreceptsScreen() {
  const router = useRouter()
  const index = useQuery({
    queryKey: ['cyberjudah-precepts'],
    queryFn: () => loadPreceptIndex(),
    staleTime: 60 * 60 * 1000,
    networkMode: 'always',
    retry: 3,
  })
  const rows = useMemo(
    () => index.data?.map(row => ({ key: row.slug, label: row.title, chips: ['Precept'] })),
    [index.data]
  )
  return (
    <LetterListScreen
      title="Precepts"
      rows={rows}
      isPending={index.isPending}
      isError={index.isError}
      searchPlaceholder="Search a precept"
      errorMessage="The precepts did not load. Check your connection."
      emptyMessage="No precept matches that."
      onOpen={slug => router.push({ pathname: '/(explore)/precept', params: { slug } })}
    />
  )
}
