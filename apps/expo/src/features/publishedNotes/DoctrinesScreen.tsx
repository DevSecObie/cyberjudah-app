import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { FlatList } from 'react-native'
import Header from '~common/Header'
import Loading from '~common/Loading'
import Box, { SafeAreaBox, TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { loadDoctrines } from './classTeaching'

/** False doctrines, A to Z: each claim answered from scripture and the classes (as in Telegram). */
const DoctrinesScreen = () => {
  const router = useRouter()
  const rows = useQuery({
    queryKey: ['cyberjudah-doctrines'],
    queryFn: () => loadDoctrines(),
    staleTime: 60 * 60 * 1000,
    networkMode: 'always',
    retry: 1,
  })

  return (
    <SafeAreaBox className="overflow-hidden border-continuous bg-reverse">
      <Header hasBackButton title="False Doctrines" />
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
                router.push({ pathname: '/(explore)/false-doctrine', params: { slug: item.slug } })
              }
            >
              <Text className="font-bold text-[16px]">{item.name}</Text>
              <Text className="text-grey text-[14px]" numberOfLines={2}>
                {item.claim}
              </Text>
            </TouchableBox>
          )}
          ListEmptyComponent={
            <Box className="py-[60px] px-[20px] items-center">
              <Text className="text-grey text-center">
                The false doctrines did not load. Check your connection.
              </Text>
            </Box>
          }
        />
      )}
    </SafeAreaBox>
  )
}

export default DoctrinesScreen
