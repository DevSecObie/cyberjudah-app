import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { LetterListScreen } from '~features/publishedNotes/studyKit'
import { caseSections, loadCaseIndex } from './caseStudies'

const KINDS = [
  ['', 'All'],
  ['judgment', 'Judgments'],
  ['blessing', 'Blessings'],
] as const

/**
 * The case studies era by era on Bible Strong's Lexicon list: each row carries its code and verdict
 * the way the Lexicon carries a word's language and number. The kind and era filters stay.
 */
const CaseStudiesScreen = () => {
  const router = useRouter()
  const index = useQuery({
    queryKey: ['cyberjudah-cases'],
    queryFn: () => loadCaseIndex(),
    staleTime: 60 * 60 * 1000,
    networkMode: 'always',
    retry: 1,
  })
  const [kind, setKind] = useState('')
  const [era, setEra] = useState('')
  const groups = useMemo(
    () =>
      caseSections(index.data, { kind, era }).map(section => ({
        title: section.title,
        data: section.data.map(row => ({
          key: row.slug,
          label: row.name,
          chips: [
            row.code ?? '',
            row.verdict.charAt(0).toUpperCase() + row.verdict.slice(1),
          ].filter(Boolean),
        })),
      })),
    [index.data, kind, era]
  )
  const charges = useMemo(
    () =>
      new Map(
        index.data?.cases.map(row => [row.slug, `${row.charge} ${row.verdict} ${row.code ?? ''}`])
      ),
    [index.data]
  )
  return (
    <LetterListScreen
      title="Case Studies"
      rows={groups.flatMap(group => group.data)}
      groups={groups}
      isPending={index.isPending}
      isError={index.isError}
      searchPlaceholder="Search a case"
      errorMessage="The case studies did not load. Check your connection."
      emptyMessage="No case found. Try a name, a charge or another era."
      matches={(slug, q) => (charges.get(slug) ?? '').toLowerCase().includes(q)}
      onReset={() => {
        setKind('')
        setEra('')
      }}
      filters={[
        {
          key: 'kind',
          icon: 'layers',
          label: 'Kind',
          value: KINDS.find(([value]) => value === kind)?.[1],
          active: !!kind,
          onPress: () => {},
          options: KINDS.map(([value, label]) => ({
            key: value || 'all',
            label,
            selected: kind === value,
            onSelect: () => setKind(value),
          })),
        },
        {
          key: 'era',
          icon: 'clock',
          label: 'Era',
          value: era || 'Every era',
          active: !!era,
          onPress: () => {},
          options: [
            { key: 'all', label: 'Every era', selected: !era, onSelect: () => setEra('') },
            ...(index.data?.eras ?? []).map(value => ({
              key: value,
              label: value,
              selected: era === value,
              onSelect: () => setEra(value),
            })),
          ],
        },
      ]}
      onOpen={slug => router.push({ pathname: '/(explore)/case-study', params: { slug } })}
    />
  )
}

export default CaseStudiesScreen
