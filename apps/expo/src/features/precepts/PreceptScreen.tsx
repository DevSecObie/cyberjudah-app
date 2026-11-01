import { useQuery } from '@tanstack/react-query'
import { useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { ScrollView } from 'react-native'
import Header from '~common/Header'
import Loading from '~common/Loading'
import { SafeAreaBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import ScriptureCard from './ScriptureCard'
import { loadPrecept, scriptureHasVerse } from './preceptsAndLaw'
import Box from '~common/ui/Box'

/** One precept: every scripture the classes read on it in Bible order, opened at one verse. */
export default function PreceptScreen() {
  const { slug = '', at = '' } = useLocalSearchParams<{ slug?: string; at?: string }>()
  const scrollRef = useRef<ScrollView>(null)
  const [atTop, setAtTop] = useState<number>()
  const precept = useQuery({
    queryKey: ['cyberjudah-precept', slug],
    queryFn: () => loadPrecept(slug),
    staleTime: 60 * 60 * 1000,
    networkMode: 'always',
    retry: 3,
  })
  // Open at the scripture of the verse the tag sits on, once it has been laid out.
  useEffect(() => {
    if (atTop != null) scrollRef.current?.scrollTo({ y: Math.max(0, atTop - 12), animated: false })
  }, [atTop])
  const opened = at
    ? precept.data?.refs.find(scripture => scriptureHasVerse(scripture, at))
    : undefined
  return (
    <SafeAreaBox className="overflow-hidden border-continuous bg-reverse">
      <Header hasBackButton background title={precept.data?.title ?? 'Precept'} />
      {precept.isPending ? (
        <Loading />
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 16, paddingBottom: 60, gap: 12 }}
        >
          {precept.data?.refs.map(scripture => (
            <Box
              key={scripture.label}
              className={scripture === opened ? 'rounded-[20px] border-[2px] border-primary' : ''}
              onLayout={
                scripture === opened ? event => setAtTop(event.nativeEvent.layout.y) : undefined
              }
            >
              <ScriptureCard scripture={scripture} />
            </Box>
          )) ?? (
            <Text className="text-grey text-center py-[40px]">
              This precept did not load. Check your connection.
            </Text>
          )}
        </ScrollView>
      )}
    </SafeAreaBox>
  )
}
