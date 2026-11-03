// A book, laid out as a Bible Strong commentary room: its room card (CommentaryRoomIntro) with the
// cover, title, year, what it is, its tags and its rights, then its chapters and the moments a
// class read from it as StudySection rows. Only the data is ours.
import { useQuery } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import Header from '~common/Header'
import Loading from '~common/Loading'
import { openInApp } from '~common/inAppBrowser'
import Box, { TouchableBox } from '~common/ui/Box'
import Card from '~common/ui/Card'
import { twMerge } from '~common/ui/classNames'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import { ListRow } from '~common/ui/ListSection'
import PageContent from '~common/ui/PageContent'
import { STUDY_COLUMN_MAX_WIDTH, StudyMoreRow, StudySection } from '~common/ui/StudySection'
import Text from '~common/ui/Text'
import { useRecordHistory } from '~features/history/useRecordHistory'
import { longDate } from '~features/notesExport/notePdf'
import { useOpenSiteLink } from '~features/publishedNotes/siteLinks'
import { dataUrl, isPublicDomain, loadBook, newestReadingsFirst, pageLabel } from './booksData'

const READINGS_FIRST = 20

/** A rounded tag of the room card, as Bible Strong's CommentaryTag. */
const RoomTag = ({
  label,
  emphasized = false,
  onPress,
}: {
  label: string
  emphasized?: boolean
  onPress?: () => void
}) => (
  <TouchableBox
    disabled={!onPress}
    onPress={onPress}
    accessibilityRole={onPress ? 'button' : undefined}
    className={twMerge(
      'overflow-hidden border-continuous px-[10px] py-[6px] rounded-full',
      emphasized ? 'bg-light-primary' : 'bg-canvas'
    )}
  >
    <Text className={twMerge(emphasized ? 'text-link' : 'text-default', 'text-[12px]')}>
      {label}
    </Text>
  </TouchableBox>
)

/** A book: its room card, its chapters, and every moment a class read from it. */
const BookScreen = () => {
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
  const pdfs = data && isPublicDomain(data.license) ? data.items : []

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
    <FormSheetScreen className="bg-canvas">
      <Box className="overflow-hidden border-continuous flex-[1] bg-canvas">
        <Header hasBackButton title={data?.title ?? 'Book'} />
        {book.isPending ? (
          <Loading />
        ) : data ? (
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 60 }}
          >
            <PageContent style={{ maxWidth: STUDY_COLUMN_MAX_WIDTH }}>
              <Card className="px-[18px] py-[17px]">
                <Box className="overflow-hidden border-continuous flex-row items-center gap-[14px]">
                  <Box
                    className="rounded-[6px] overflow-hidden bg-canvas"
                    style={{ width: 56, height: 78 }}
                  >
                    {data.cover ? (
                      <Image
                        source={{ uri: dataUrl(data.cover) }}
                        style={{ width: 56, height: 78 }}
                        contentFit="cover"
                        accessible={false}
                      />
                    ) : null}
                  </Box>
                  <Box className="overflow-hidden border-continuous flex-[1] gap-[3px]">
                    <Text className="text-[19px] leading-[23px] font-semibold" numberOfLines={3}>
                      {data.title}
                    </Text>
                    <Text className="text-grey text-[13px]" numberOfLines={2}>
                      {[data.author, data.year].filter(Boolean).join(', ')}
                    </Text>
                  </Box>
                </Box>
                <Box
                  className="border-continuous overflow-hidden mt-[16px] pt-[16px] border-separator"
                  style={{ borderTopWidth: StyleSheet.hairlineWidth }}
                >
                  {!!data.subtitle && (
                    <Text className="text-[15px] leading-[22px] text-default">{data.subtitle}</Text>
                  )}
                  <Box className="overflow-hidden border-continuous flex-row flex-wrap mt-[15px] gap-[8px]">
                    <RoomTag emphasized label="English" />
                    {pdfs.map((item, index) => (
                      <RoomTag
                        key={item.id}
                        label={pdfs.length > 1 ? item.label || `Volume ${index + 1}` : 'PDF'}
                        onPress={() =>
                          router.push({
                            pathname: '/(explore)/book-pdf',
                            params: { slug, item: item.id, title: data.title },
                          })
                        }
                      />
                    ))}
                  </Box>
                </Box>
                {(!!data.publisher || !!data.license || !!data.source) && (
                  <Box
                    className="border-continuous overflow-hidden mt-[16px] pt-[14px] border-separator gap-[4px]"
                    style={{ borderTopWidth: StyleSheet.hairlineWidth }}
                  >
                    {!!data.publisher && (
                      <Text className="text-tertiary text-[12px] leading-[17px]">
                        {data.publisher}
                      </Text>
                    )}
                    {!!data.license && (
                      <Text className="text-tertiary text-[12px] leading-[17px]">
                        {data.license}
                      </Text>
                    )}
                    {!!data.source && (
                      <TouchableBox accessibilityRole="link" onPress={() => openInApp(data.source)}>
                        <Text className="text-link text-[12px]">The printed original</Text>
                      </TouchableBox>
                    )}
                  </Box>
                )}
              </Card>
            </PageContent>
            {data.chapters.length > 0 && (
              <StudySection title="Chapters" surface="rows" className="mt-[10px]">
                {data.chapters.map(chapter => (
                  <ListRow
                    key={chapter.k}
                    label={[chapter.n, chapter.title].filter(Boolean).join('. ')}
                    description={[
                      data.volumes > 1 || chapter.volume !== data.title ? chapter.volume : '',
                      pageLabel(data, chapter.vol, chapter.page),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    onPress={() =>
                      router.push({
                        pathname: '/(explore)/book-chapter',
                        params: { slug, k: String(chapter.k) },
                      })
                    }
                  />
                ))}
              </StudySection>
            )}
            {readings.length > 0 && (
              <StudySection title="Read in class" surface="rows">
                {[
                  ...(allReadings ? readings : readings.slice(0, READINGS_FIRST)).map(reading => (
                    <ListRow
                      key={`${reading.video}${reading.t}`}
                      label={reading.title}
                      description={[
                        longDate(reading.date),
                        reading.teacher,
                        pageLabel(data, reading.vol, reading.page),
                        `from ${reading.ts}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                      onPress={() =>
                        openMoment({
                          video: reading.video,
                          t: reading.t,
                          note: reading.url ?? undefined,
                        })
                      }
                    />
                  )),
                  ...(!allReadings && readings.length > READINGS_FIRST
                    ? [
                        <StudyMoreRow
                          key="more"
                          label="All the moments"
                          onPress={() => setAllReadings(true)}
                        />,
                      ]
                    : []),
                ]}
              </StudySection>
            )}
          </ScrollView>
        ) : (
          <Box className="py-[60px] px-[20px] items-center">
            <Text className="text-grey text-center">
              This book did not load. Check your connection.
            </Text>
          </Box>
        )}
      </Box>
    </FormSheetScreen>
  )
}

export default BookScreen
