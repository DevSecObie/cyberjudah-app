import { useQuery } from '@tanstack/react-query'
import { useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { ScrollView } from 'react-native'
import Header from '~common/Header'
import Loading from '~common/Loading'
import { SafeAreaBox, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import ScriptureCard from './ScriptureCard'
import { loadLawSection } from './preceptsAndLaw'

/** A section of the Handbook of the Law: each law, then the scripture it stands on. */
export default function LawSectionScreen() {
  const { id = '', law = '' } = useLocalSearchParams<{ id?: string; law?: string }>()
  const scrollRef = useRef<ScrollView>(null)
  const [lawTop, setLawTop] = useState<number>()
  const section = useQuery({
    queryKey: ['cyberjudah-law-section', id],
    queryFn: () => loadLawSection(id),
    staleTime: 60 * 60 * 1000,
    networkMode: 'always',
    retry: 3,
  })
  // Open at the law the verse's tag names, once it has been laid out.
  useEffect(() => {
    if (lawTop != null)
      scrollRef.current?.scrollTo({ y: Math.max(0, lawTop - 12), animated: false })
  }, [lawTop])
  return (
    <SafeAreaBox className="overflow-hidden border-continuous bg-reverse">
      <Header
        hasBackButton
        background
        title={section.data ? `${section.data.id} · ${section.data.title}` : 'The Law'}
      />
      {section.isPending ? (
        <Loading />
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 16, paddingBottom: 60, gap: 22 }}
        >
          {section.data?.entries.map(entry => (
            <VStack
              key={entry.id}
              className={`gap-[10px] ${entry.id === law ? 'rounded-[14px] bg-light-primary p-[12px]' : ''}`}
              onLayout={
                entry.id === law ? event => setLawTop(event.nativeEvent.layout.y) : undefined
              }
            >
              <Text className="text-primary text-[13px] font-bold">{entry.id}</Text>
              <Text className="text-[18px] leading-[26px]">{entry.text}</Text>
              {entry.refs.map(scripture => (
                <ScriptureCard key={scripture.label} scripture={scripture} />
              ))}
            </VStack>
          )) ?? (
            <Text className="text-grey text-center py-[40px]">
              This section did not load. Check your connection.
            </Text>
          )}
        </ScrollView>
      )}
    </SafeAreaBox>
  )
}
