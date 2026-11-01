import { useQuery } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView } from 'react-native'
import { openInApp } from '~common/inAppBrowser'
import Header from '~common/Header'
import Loading from '~common/Loading'
import Box, { HStack, SafeAreaBox, TouchableBox, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { useRecordHistory } from '~features/history/useRecordHistory'
import { longDate } from '~features/notesExport/notePdf'
import { LinkRow, Section } from '~features/publishedNotes/parts'
import { useOpenSiteLink } from '~features/publishedNotes/siteLinks'
import { resolveFontFamily } from '~themes/styleValues'
import { useTheme } from '~themes/ThemeProvider'
import { dataUrl, loadBook, newestReadingsFirst, pageLabel } from './booksData'

const READINGS_FIRST = 20

/** A book: what it is, every moment a class read from it, and its chapters to read. */
const BookScreen = () => {
  const theme = useTheme()
  const router = useRouter()
  const { openMoment } = useOpenSiteLink()
  const { slug = '' } = useLocalSearchParams<{ slug?: string }>()
  const [allReadings, setAllReadings] = useState(false)
  const book = useQuery({
    queryKey: ['cyberjudah-book', slug],
    queryFn: () => loadBook(slug),
    enabled: !!slug,
    staleTime: 60 * 60 * 1000,
    networkMode: 'always',
    retry: 1,
  })
  const data = book.data
  const readings = data ? newestReadingsFirst(data.reads) : []

  useRecordHistory(
    data?.title
      ? {
          type: 'cyberjudah',
          kind: 'book',
          title: data.title,
          pathname: '/(explore)/book',
          params: { slug },
        }
      : null
  )

  return (
    <SafeAreaBox className="overflow-hidden border-continuous bg-reverse">
      <Header hasBackButton title={data?.title ?? 'Book'} />
      {book.isPending ? (
        <Loading />
      ) : data ? (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
          <HStack className="gap-[16px] items-start">
            {data.cover ? (
              <Image
                source={{ uri: dataUrl(data.cover) }}
                style={{ width: 96, height: 136, borderRadius: 8 }}
                contentFit="cover"
                accessible={false}
              />
            ) : null}
            <VStack className="flex-[1] gap-[6px]">
              <Text
                className="text-[24px] leading-[30px]"
                style={{ fontFamily: resolveFontFamily(theme.fontFamily.title) }}
              >
                {data.title}
              </Text>
              <Text className="text-grey text-[14px]">
                {[data.author, data.year].filter(Boolean).join(', ')}
              </Text>
              {data.classes > 0 && (
                <Text className="text-primary text-[13px] font-bold">
                  Read in {data.classes} {data.classes === 1 ? 'class' : 'classes'}
                </Text>
              )}
            </VStack>
          </HStack>
          {!!data.subtitle && (
            <Text className="text-[15px] leading-[22px] mt-[16px]">{data.subtitle}</Text>
          )}
          {readings.length > 0 && (
            <Section title="Read in class">
              {(allReadings ? readings : readings.slice(0, READINGS_FIRST)).map(reading => (
                <LinkRow
                  key={`${reading.video}${reading.t}`}
                  meta={[longDate(reading.date), reading.teacher, `from ${reading.ts}`]
                    .filter(Boolean)
                    .join(' · ')}
                  title={reading.title}
                  sub={pageLabel(data, reading.vol, reading.page)}
                  onPress={() =>
                    openMoment({
                      video: reading.video,
                      t: reading.t,
                      note: reading.url ?? undefined,
                    })
                  }
                />
              ))}
              {!allReadings && readings.length > READINGS_FIRST && (
                <TouchableBox accessibilityRole="button" onPress={() => setAllReadings(true)}>
                  <Text className="text-primary text-[15px] font-bold">
                    All {readings.length} moments
                  </Text>
                </TouchableBox>
              )}
            </Section>
          )}
          {data.chapters.length > 0 && (
            <Section title="Chapters">
              {data.chapters.map(chapter => (
                <LinkRow
                  key={chapter.k}
                  meta={[
                    data.volumes > 1 || chapter.volume !== data.title ? chapter.volume : '',
                    `${pageLabel(data, chapter.vol, chapter.page)}`,
                    chapter.reads
                      ? `read ${chapter.reads} ${chapter.reads === 1 ? 'time' : 'times'} in class`
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  title={[chapter.n, chapter.title].filter(Boolean).join('. ')}
                  onPress={() =>
                    router.push({
                      pathname: '/(explore)/book-chapter',
                      params: { slug, k: String(chapter.k) },
                    })
                  }
                />
              ))}
            </Section>
          )}
          <Box className="mt-[26px] gap-[4px]">
            {!!data.publisher && <Text className="text-grey text-[12px]">{data.publisher}</Text>}
            {!!data.license && <Text className="text-grey text-[12px]">{data.license}</Text>}
            {!!data.source && (
              <TouchableBox accessibilityRole="link" onPress={() => openInApp(data.source)}>
                <Text className="text-primary text-[12px]">The printed original</Text>
              </TouchableBox>
            )}
          </Box>
        </ScrollView>
      ) : (
        <Box className="py-[60px] px-[20px] items-center">
          <Text className="text-grey text-center">
            This book did not load. Check your connection.
          </Text>
        </Box>
      )}
    </SafeAreaBox>
  )
}

export default BookScreen
