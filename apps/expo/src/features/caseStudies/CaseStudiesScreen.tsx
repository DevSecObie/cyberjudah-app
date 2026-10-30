import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { SectionList } from 'react-native'
import PanelSearch from '~common/ContextualPanel/PanelSearch'
import FiltersHeader from '~common/FiltersHeader'
import Loading from '~common/Loading'
import Box, { SafeAreaBox, TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { caseSections, loadCaseIndex } from './caseStudies'

const KINDS = [
  ['', 'All'],
  ['judgment', 'Judgments'],
  ['blessing', 'Blessings'],
] as const

/** The case studies, era by era, with the search and the kind and era filters (as in Telegram). */
const CaseStudiesScreen = () => {
  const router = useRouter()
  const index = useQuery({
    queryKey: ['cyberjudah-cases'],
    queryFn: () => loadCaseIndex(),
    staleTime: 60 * 60 * 1000,
    networkMode: 'always',
    retry: 1,
  })
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('')
  const [era, setEra] = useState('')
  const sections = useMemo(
    () => caseSections(index.data, { query, kind, era }),
    [index.data, query, kind, era]
  )
  const count = (value: string) =>
    (index.data?.cases ?? []).filter(row => !value || row.kind === value).length

  return (
    <SafeAreaBox className="overflow-hidden border-continuous bg-reverse">
      <FiltersHeader
        hasBackButton
        title="Case studies"
        onReset={() => {
          setQuery('')
          setKind('')
          setEra('')
        }}
        filters={[
          {
            key: 'search',
            icon: 'search',
            label: 'Search',
            value: query.trim() || undefined,
            active: !!query.trim(),
            onPress: () => {},
            content: () => <PanelSearch value={query} onChange={setQuery} />,
          },
          {
            key: 'kind',
            icon: 'layers',
            label: 'Kind',
            value: KINDS.find(([value]) => value === kind)?.[1],
            active: !!kind,
            onPress: () => {},
            options: KINDS.map(([value, label]) => ({
              key: value || 'all',
              label: index.data ? `${label} (${count(value)})` : label,
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
      />
      {index.isPending ? (
        <Loading />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.slug}
          stickySectionHeadersEnabled
          contentContainerStyle={{ paddingBottom: 48 }}
          renderSectionHeader={({ section }) => (
            <Box className="bg-light-grey px-[20px] py-[8px]">
              <Text className="text-[13px] font-bold text-tertiary">{section.title}</Text>
            </Box>
          )}
          renderItem={({ item }) => (
            <TouchableBox
              accessibilityRole="button"
              className="px-[20px] py-[14px] border-b-[1px] border-border gap-[3px]"
              onPress={() =>
                router.push({ pathname: '/(explore)/case-study', params: { slug: item.slug } })
              }
            >
              <Text className="font-bold text-[16px]" numberOfLines={2}>
                {item.name}
              </Text>
              <Text className="text-grey text-[14px]" numberOfLines={2}>
                {item.charge}
              </Text>
            </TouchableBox>
          )}
          ListEmptyComponent={
            <Box className="py-[60px] px-[20px] items-center">
              <Text className="text-grey text-center">
                {index.isError
                  ? 'The case studies did not load. Check your connection.'
                  : 'No case found. Try a name, a charge or another era.'}
              </Text>
            </Box>
          }
        />
      )}
    </SafeAreaBox>
  )
}

export default CaseStudiesScreen
