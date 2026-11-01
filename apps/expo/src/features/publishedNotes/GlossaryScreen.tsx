import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { SectionList } from 'react-native'
import PanelSearch from '~common/ContextualPanel/PanelSearch'
import FiltersHeader from '~common/FiltersHeader'
import Loading from '~common/Loading'
import Box, { HStack, SafeAreaBox, TouchableBox, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { glossarySections, loadGlossary } from './classTeaching'
import { clock, useOpenSiteLink } from './siteLinks'

/** The words the classes use, A to Z: each defined, its scriptures, and where it is taught. */
const GlossaryScreen = () => {
  const { open, openMoment } = useOpenSiteLink()
  const glossary = useQuery({
    queryKey: ['cyberjudah-glossary'],
    queryFn: () => loadGlossary(),
    staleTime: 60 * 60 * 1000,
    networkMode: 'always',
    retry: 1,
  })
  const [query, setQuery] = useState('')
  const sections = useMemo(
    () => glossarySections(glossary.data?.entries, query),
    [glossary.data, query]
  )

  return (
    <SafeAreaBox className="overflow-hidden border-continuous bg-reverse">
      <FiltersHeader
        hasBackButton
        title="Glossary"
        onReset={() => setQuery('')}
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
        ]}
      />
      {glossary.isPending ? (
        <Loading />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.slug}
          stickySectionHeadersEnabled
          contentContainerStyle={{ paddingBottom: 48 }}
          ListHeaderComponent={
            glossary.data?.about ? (
              <Box className="px-[20px] pt-[16px] pb-[8px]">
                <Text className="text-grey text-[14px]">{glossary.data.about}</Text>
              </Box>
            ) : null
          }
          renderSectionHeader={({ section }) => (
            <Box className="bg-light-grey px-[20px] py-[8px]">
              <Text className="text-[13px] font-bold text-tertiary">{section.title}</Text>
            </Box>
          )}
          renderItem={({ item }) => (
            <VStack className="px-[20px] py-[14px] border-b-[1px] border-border gap-[6px]">
              <Text className="font-bold text-[16px]">
                {item.term}
                {item.aliases.length ? (
                  <Text className="text-grey text-[14px]"> · also {item.aliases.join(', ')}</Text>
                ) : null}
              </Text>
              <Text className="text-[15px] leading-[22px]">{item.definition}</Text>
              {(item.scripture.length > 0 || item.see.length > 0) && (
                <HStack className="flex-wrap gap-x-[12px] gap-y-[4px]">
                  {item.scripture.map(ref => (
                    <TouchableBox
                      key={ref.label}
                      accessibilityRole="link"
                      onPress={() => open(ref.url)}
                    >
                      <Text className="text-primary text-[14px] font-bold">{ref.label}</Text>
                    </TouchableBox>
                  ))}
                  {item.see.map(ref => (
                    <TouchableBox
                      key={ref.url}
                      accessibilityRole="link"
                      onPress={() => open(ref.url)}
                    >
                      <Text className="text-primary text-[14px]">See {ref.title}</Text>
                    </TouchableBox>
                  ))}
                </HStack>
              )}
              {item.taught.map(moment => (
                <TouchableBox
                  key={`${moment.video}@${moment.seconds}`}
                  accessibilityRole="link"
                  onPress={() => openMoment({ video: moment.video, t: moment.seconds })}
                >
                  <Text className="text-grey text-[13px]" numberOfLines={1}>
                    ▶ {moment.title} · {clock(moment.seconds)}
                  </Text>
                </TouchableBox>
              ))}
            </VStack>
          )}
          ListEmptyComponent={
            <Box className="py-[60px] px-[20px] items-center">
              <Text className="text-grey text-center">
                {glossary.isError
                  ? 'The glossary did not load. Check your connection.'
                  : 'No word matches.'}
              </Text>
            </Box>
          }
        />
      )}
    </SafeAreaBox>
  )
}

export default GlossaryScreen
