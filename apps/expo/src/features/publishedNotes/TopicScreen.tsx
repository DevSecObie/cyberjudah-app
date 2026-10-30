import { useQuery } from '@tanstack/react-query'
import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ScrollView } from 'react-native'
import Header from '~common/Header'
import Loading from '~common/Loading'
import Box, { SafeAreaBox, TouchableBox, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { longDate } from '~features/notesExport/notePdf'
import { resolveFontFamily } from '~themes/styleValues'
import { useTheme } from '~themes/ThemeProvider'
import { loadTopic } from './classTeaching'
import { LinkRow, Scripture, Section } from './parts'
import { useOpenSiteLink } from './siteLinks'

const THREAD_FIRST = 12

/** A topic: the scriptures the classes opened on it in Bible order, then its classes and cases. */
const TopicScreen = () => {
  const theme = useTheme()
  const { slug = '' } = useLocalSearchParams<{ slug?: string }>()
  const { open } = useOpenSiteLink()
  const [allThread, setAllThread] = useState(false)
  const topic = useQuery({
    queryKey: ['cyberjudah-topic', slug],
    queryFn: () => loadTopic(slug),
    enabled: !!slug,
    staleTime: 60 * 60 * 1000,
    networkMode: 'always',
    retry: 1,
  })
  const data = topic.data
  const thread = data?.thread ?? []
  const notes = data?.items.filter(item => item.kind !== 'case') ?? []
  const cases = data?.items.filter(item => item.kind === 'case') ?? []

  return (
    <SafeAreaBox className="overflow-hidden border-continuous bg-reverse">
      <Header hasBackButton title={data?.label ?? 'Topic'} />
      {topic.isPending ? (
        <Loading />
      ) : data ? (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
          <Text
            className="text-[26px] leading-[32px]"
            style={{ fontFamily: resolveFontFamily(theme.fontFamily.title) }}
          >
            {data.label}
          </Text>
          {thread.length > 0 && (
            <Section title="The Thread">
              <Text className="text-grey text-[14px]">
                The scriptures the classes opened on this, in Bible order.
              </Text>
              {(allThread ? thread : thread.slice(0, THREAD_FIRST)).map(stop => (
                <VStack key={`${stop.url}${stop.label}`} className="gap-[6px]">
                  <Scripture
                    scripture={{
                      label: stop.label,
                      url: stop.url,
                      text: [{ verse: 0, text: stop.text }],
                    }}
                    onOpen={open}
                  />
                  {stop.classes.slice(0, 3).map(item => (
                    <LinkRow
                      key={`${item.url}${item.t ?? ''}`}
                      meta={[item.ts, longDate(item.date), item.teacher]
                        .filter(Boolean)
                        .join(' · ')}
                      title={item.title}
                      onPress={() => open(item.url)}
                    />
                  ))}
                </VStack>
              ))}
              {!allThread && thread.length > THREAD_FIRST && (
                <TouchableBox accessibilityRole="button" onPress={() => setAllThread(true)}>
                  <Text className="text-primary text-[15px] font-bold">All the scriptures</Text>
                </TouchableBox>
              )}
            </Section>
          )}
          {notes.length > 0 && (
            <Section title="Classes and Episodes">
              {notes.map(item => (
                <LinkRow
                  key={item.url}
                  meta={[
                    item.kind === 'captains' ? 'Captains' : 'Class',
                    longDate(item.date),
                    item.teacher,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  title={item.title}
                  onPress={() => open(item.url)}
                />
              ))}
            </Section>
          )}
          {cases.length > 0 && (
            <Section title="Cases">
              {cases.map(item => (
                <LinkRow
                  key={item.url}
                  meta={item.verdict}
                  title={item.title}
                  sub={item.charge}
                  onPress={() => open(item.url)}
                />
              ))}
            </Section>
          )}
        </ScrollView>
      ) : (
        <Box className="py-[60px] px-[20px] items-center">
          <Text className="text-grey text-center">
            This topic did not load. Check your connection.
          </Text>
        </Box>
      )}
    </SafeAreaBox>
  )
}

export default TopicScreen
