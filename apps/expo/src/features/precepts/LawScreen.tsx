import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { SectionList } from 'react-native'
import Header from '~common/Header'
import Loading from '~common/Loading'
import Box, { SafeAreaBox, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { loadLawIndex } from './preceptsAndLaw'

/** The Handbook of the Law: its parts, each with its sections. */
export default function LawScreen() {
  const router = useRouter()
  const index = useQuery({
    queryKey: ['cyberjudah-law'],
    queryFn: () => loadLawIndex(),
    staleTime: 60 * 60 * 1000,
    networkMode: 'always',
    retry: 3,
  })
  const sections = (index.data ?? []).map(part => ({
    title: `${part.n}. ${part.title}`,
    data: part.sections,
  }))
  return (
    <SafeAreaBox className="overflow-hidden border-continuous bg-reverse">
      <Header hasBackButton background title="Handbook of the Law" />
      {index.isPending ? (
        <Loading />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
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
              className="flex-row items-center gap-[12px] px-[20px] py-[14px] border-b-[1px] border-border"
              onPress={() =>
                router.push({ pathname: '/(explore)/law-section', params: { id: item.id } })
              }
            >
              <Text className="text-primary text-[13px] font-bold w-[30px]">{item.id}</Text>
              <Text className="flex-[1] text-[16px]">{item.title}</Text>
              <FeatherIcon name="chevron-right" size={18} color="grey" />
            </TouchableBox>
          )}
          ListEmptyComponent={
            <Box className="py-[60px] px-[20px] items-center">
              <Text className="text-grey text-center">
                The Law did not load. Check your connection.
              </Text>
            </Box>
          }
        />
      )}
    </SafeAreaBox>
  )
}
