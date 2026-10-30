import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { FlatList } from 'react-native'
import Header from '~common/Header'
import Loading from '~common/Loading'
import Box, { SafeAreaBox, TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { loadEncyclopedia, readCachedEncyclopedia } from './publishedNotes'

/** The Encyclopedia: standing subjects, walked through book by book (as in Telegram). */
const EncyclopediaScreen = () => {
  const router = useRouter()
  const rows = useQuery({
    queryKey: ['cyberjudah-encyclopedia'],
    queryFn: () => loadEncyclopedia(),
    initialData: readCachedEncyclopedia() ?? undefined,
    staleTime: 60 * 60 * 1000,
    networkMode: 'always',
    retry: 1,
  })

  return (
    <SafeAreaBox className="overflow-hidden border-continuous bg-reverse">
      <Header hasBackButton title="Encyclopedia" />
      {rows.isPending ? (
        <Loading />
      ) : (
        <FlatList
          data={rows.data ?? []}
          keyExtractor={item => item.slug}
          contentContainerStyle={{ paddingBottom: 48 }}
          renderItem={({ item }) => (
            <TouchableBox
              accessibilityRole="button"
              className="px-[20px] py-[14px] border-b-[1px] border-border gap-[3px]"
              onPress={() =>
                router.push({ pathname: '/(explore)/published-note', params: { path: item.url } })
              }
            >
              <Text className="font-bold text-[16px]" numberOfLines={2}>
                {item.title}
              </Text>
              {!!item.summary && (
                <Text className="text-grey text-[14px]" numberOfLines={2}>
                  {item.summary}
                </Text>
              )}
            </TouchableBox>
          )}
          ListEmptyComponent={
            <Box className="py-[60px] px-[20px] items-center">
              <Text className="text-grey text-center">
                The Encyclopedia did not load. Check your connection.
              </Text>
            </Box>
          }
        />
      )}
    </SafeAreaBox>
  )
}

export default EncyclopediaScreen
