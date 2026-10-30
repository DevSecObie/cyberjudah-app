import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { FlatList } from 'react-native'
import PanelSearch from '~common/ContextualPanel/PanelSearch'
import FiltersHeader from '~common/FiltersHeader'
import Loading from '~common/Loading'
import Box, { SafeAreaBox, TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { loadTopics } from './classTeaching'

/** The topics the classes teach on, each gathering its classes and cases (as in Telegram). */
const TopicsScreen = () => {
  const router = useRouter()
  const rows = useQuery({
    queryKey: ['cyberjudah-topics'],
    queryFn: () => loadTopics(),
    staleTime: 60 * 60 * 1000,
    networkMode: 'always',
    retry: 1,
  })
  const [query, setQuery] = useState('')
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (rows.data ?? []).filter(row => !q || row.label.toLowerCase().includes(q))
  }, [rows.data, query])

  return (
    <SafeAreaBox className="overflow-hidden border-continuous bg-reverse">
      <FiltersHeader
        hasBackButton
        title="Topics"
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
      {rows.isPending ? (
        <Loading />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={item => item.slug}
          contentContainerStyle={{ paddingBottom: 48 }}
          renderItem={({ item }) => (
            <TouchableBox
              accessibilityRole="button"
              className="px-[20px] py-[14px] border-b-[1px] border-border gap-[3px]"
              onPress={() =>
                router.push({ pathname: '/(explore)/topic', params: { slug: item.slug } })
              }
            >
              <Text className="font-bold text-[16px]">{item.label}</Text>
            </TouchableBox>
          )}
          ListEmptyComponent={
            <Box className="py-[60px] px-[20px] items-center">
              <Text className="text-grey text-center">
                {rows.isError
                  ? 'The topics did not load. Check your connection.'
                  : 'No topic found.'}
              </Text>
            </Box>
          }
        />
      )}
    </SafeAreaBox>
  )
}

export default TopicsScreen
