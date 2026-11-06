import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { SectionList } from 'react-native'
import PanelSearch from '~common/ContextualPanel/PanelSearch'
import FiltersHeader from '~common/FiltersHeader'
import Loading from '~common/Loading'
import Box, { SafeAreaBox, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { loadPreceptIndex, preceptSections } from './preceptsAndLaw'

/** The precepts A to Z, with a search, as Bible Strong lists its Nave topics. */
export default function PreceptsScreen() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const index = useQuery({
    queryKey: ['cyberjudah-precepts'],
    queryFn: () => loadPreceptIndex(),
    staleTime: 60 * 60 * 1000,
    networkMode: 'always',
    retry: 3,
  })
  const sections = useMemo(() => preceptSections(index.data ?? [], query), [index.data, query])
  return (
    <SafeAreaBox className="overflow-hidden border-continuous bg-reverse">
      <FiltersHeader
        hasBackButton
        title="Precepts"
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
      {index.isPending ? (
        <Loading />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.slug}
          stickySectionHeadersEnabled
          contentContainerStyle={{ paddingBottom: 48 }}
          renderSectionHeader={({ section }) => (
            <Box className="bg-light-grey px-[20px] py-[6px]">
              <Text className="text-[13px] font-bold text-tertiary">{section.title}</Text>
            </Box>
          )}
          renderItem={({ item }) => (
            <TouchableBox
              accessibilityRole="button"
              className="flex-row items-center px-[20px] py-[14px] border-b-[1px] border-border"
              onPress={() =>
                router.push({ pathname: '/(explore)/precept', params: { slug: item.slug } })
              }
            >
              <Text className="flex-[1] text-[16px]">{item.title}</Text>
              <FeatherIcon name="chevron-right" size={18} color="grey" />
            </TouchableBox>
          )}
          ListEmptyComponent={
            <Box className="py-[60px] px-[20px] items-center">
              <Text className="text-grey text-center">
                {index.isError
                  ? 'The precepts did not load. Check your connection.'
                  : 'No precept matches that.'}
              </Text>
            </Box>
          }
        />
      )}
    </SafeAreaBox>
  )
}
