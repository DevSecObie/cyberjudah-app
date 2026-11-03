import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { loadGlossary } from './classTeaching'
import { LetterListScreen } from './studyKit'

export const useGlossary = () =>
  useQuery({
    queryKey: ['cyberjudah-glossary'],
    queryFn: () => loadGlossary(),
    staleTime: 60 * 60 * 1000,
    networkMode: 'always',
    retry: 1,
  })

/** The words the classes use, A to Z, on Bible Strong's Lexicon list. */
const GlossaryScreen = () => {
  const router = useRouter()
  const glossary = useGlossary()
  const entries = glossary.data?.entries
  const rows = useMemo(
    () =>
      entries?.map(entry => ({
        key: entry.slug,
        label: entry.term,
        chips: ['Glossary', ...entry.aliases.slice(0, 1)],
      })),
    [entries]
  )
  const bySlug = useMemo(() => new Map(entries?.map(e => [e.slug, e])), [entries])
  return (
    <LetterListScreen
      title="Glossary"
      rows={rows}
      isPending={glossary.isPending}
      isError={glossary.isError}
      searchPlaceholder="Search a word"
      errorMessage="The glossary did not load. Check your connection."
      emptyMessage="No word matches."
      matches={(slug, q) => {
        const entry = bySlug.get(slug)
        return (
          !!entry &&
          (entry.aliases.some(a => a.toLowerCase().includes(q)) ||
            entry.definition.toLowerCase().includes(q))
        )
      }}
      onOpen={slug => router.push({ pathname: '/(explore)/glossary-word', params: { slug } })}
    />
  )
}

export default GlossaryScreen
