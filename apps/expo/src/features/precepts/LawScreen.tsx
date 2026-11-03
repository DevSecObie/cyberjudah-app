import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { LetterListScreen } from '~features/publishedNotes/studyKit'
import { loadLawIndex } from './preceptsAndLaw'

/** The Handbook of the Law, part by part, on Bible Strong's list with its section titles. */
export default function LawScreen() {
  const router = useRouter()
  const index = useQuery({
    queryKey: ['cyberjudah-law'],
    queryFn: () => loadLawIndex(),
    staleTime: 60 * 60 * 1000,
    networkMode: 'always',
    retry: 3,
  })
  const groups = useMemo(
    () =>
      index.data?.map(part => ({
        title: `${part.n} · ${part.title}`,
        data: part.sections.map(section => ({ key: section.id, label: section.title })),
      })),
    [index.data]
  )
  return (
    <LetterListScreen
      title="The Law"
      rows={groups?.flatMap(group => group.data)}
      groups={groups ?? []}
      isPending={index.isPending}
      isError={index.isError}
      searchPlaceholder="Search the law"
      errorMessage="The Law did not load. Check your connection."
      emptyMessage="No section matches that."
      onOpen={id => router.push({ pathname: '/(explore)/law-section', params: { id } })}
    />
  )
}
