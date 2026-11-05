// A chapter of a book, read as Bible Strong's commentary reading card (CommentaryEntryScreen):
// the room's header, then the text in a Card, its scriptures as links that open the Bible.
// Pages are native text (one card per printed page), never a web view per card.
import { useQuery } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import React from 'react'
import { FlatList, StyleSheet } from 'react-native'
import Header from '~common/Header'
import Loading from '~common/Loading'
import { openInApp } from '~common/inAppBrowser'
import Box, { HStack, TouchableBox, VStack } from '~common/ui/Box'
import Card from '~common/ui/Card'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import { FeatherIcon } from '~common/ui/Icon'
import { STUDY_COLUMN_MAX_WIDTH } from '~common/ui/StudySection'
import Text from '~common/ui/Text'
import { parseInlineBibleReferencesInAnyLanguage } from '~helpers/bcvParser'
import { getBibleViewRouteForStrongOsisReference } from '~features/lexique/strongReferenceNavigation'
import { longDate } from '~features/notesExport/longDate'
import { useOpenSiteLink } from '~features/publishedNotes/siteLinks'
import { titleFontStyle } from '~themes/styleValues'
import { useTheme } from '~themes/ThemeProvider'
import { isPublicDomain, loadBook, loadBookChapter, pageLabel, scanUrl } from './booksData'
import { IS_FORM_SHEET } from '~helpers/constants'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'

/** A paragraph whose scriptures are links, as the reading card's verse links. */
const LinkedParagraph = ({ text, onOsis }: { text: string; onOsis: (osis: string) => void }) => {
  const references = parseInlineBibleReferencesInAnyLanguage(text)
  const parts: React.ReactNode[] = []
  let cursor = 0
  for (const reference of references) {
    if (reference.start > cursor) parts.push(text.slice(cursor, reference.start))
    parts.push(
      <Text
        key={reference.start}
        className="text-link"
        accessibilityRole="link"
        onPress={() => onOsis(reference.target.osis)}
      >
        {reference.text}
      </Text>
    )
    cursor = reference.end
  }
  if (cursor < text.length) parts.push(text.slice(cursor))
  return (
    <Text selectable className="text-[17px] leading-[27px] text-default">
      {parts}
    </Text>
  )
}

/** A chapter of a book, page by page as printed, each page with the classes that read it. */
const BookChapterScreen = () => {
  const theme = useTheme()
  const router = useRouter()
  const canGoBackInStack = useCanGoBackInStack()
  const { openMoment } = useOpenSiteLink()
  const { slug = '', k = '' } = useLocalSearchParams<{ slug?: string; k?: string }>()
  const index = Number(k)
  const book = useQuery({
    queryKey: ['cyberjudah-book', slug],
    queryFn: () => loadBook(slug),
    enabled: !!slug,
    staleTime: 60 * 60 * 1000,
    networkMode: 'always',
    retry: 1,
  })
  const chapter = useQuery({
    queryKey: ['cyberjudah-book-chapter', slug, index],
    queryFn: () => loadBookChapter(slug, index),
    enabled: !!slug && Number.isInteger(index),
    staleTime: 60 * 60 * 1000,
    networkMode: 'always',
    retry: 1,
  })
  const data = chapter.data
  const volumes = book.data?.volumes ?? 1
  const title = data ? [data.n, data.title].filter(Boolean).join('. ') : 'Chapter'
  const openOsis = (osis: string) => {
    const route = getBibleViewRouteForStrongOsisReference(osis)
    if (route) router.push(route)
  }

  return (
    <FormSheetScreen className="bg-canvas" isFormSheet={IS_FORM_SHEET}>
      <Box className="overflow-hidden border-continuous flex-[1] bg-canvas">
        <Header
          hasBackButton={IS_FORM_SHEET ? canGoBackInStack : true}
          title={book.data?.title ?? title}
        />
        {chapter.isPending ? (
          <Loading />
        ) : data ? (
          <FlatList
            data={data.pages}
            keyExtractor={page => `${page.vol}-${page.page}`}
            contentContainerStyle={{
              width: '100%',
              maxWidth: STUDY_COLUMN_MAX_WIDTH + 40,
              alignSelf: 'center',
              paddingHorizontal: 20,
              paddingTop: 16,
              paddingBottom: 60,
            }}
            ItemSeparatorComponent={() => <Box className="h-[14px]" />}
            ListHeaderComponent={
              <Text
                className="text-[24px] leading-[30px] mb-[14px] mx-[4px]"
                style={titleFontStyle(theme)}
              >
                {title}
              </Text>
            }
            renderItem={({ item: page }) => {
              const scan = scanUrl(book.data?.scan ?? '', data.item, page.img)
              const pdf =
                book.data && data.item && isPublicDomain(book.data.license)
                  ? () =>
                      router.push({
                        pathname: '/(explore)/book-pdf',
                        params: {
                          slug,
                          item: data.item ?? '',
                          printed: String(page.page),
                          title: book.data?.title ?? '',
                        },
                      })
                  : scan
                    ? () => openInApp(scan)
                    : undefined
              return (
                <Card className="px-[18px] py-[18px]">
                  <HStack className="items-center justify-between">
                    <Box className="overflow-hidden border-continuous px-[11px] py-[5px] rounded-full bg-light-primary">
                      <Text className="text-link font-bold text-[13px]">
                        {pageLabel({ volumes }, page.vol, page.page)}
                      </Text>
                    </Box>
                    {pdf ? (
                      <TouchableBox accessibilityRole="link" onPress={pdf}>
                        <Text className="text-link text-[13px]">Printed page</Text>
                      </TouchableBox>
                    ) : null}
                  </HStack>
                  {page.reads.length > 0 && (
                    <VStack className="mt-[12px] gap-[8px]">
                      {page.reads.map(reading => (
                        <TouchableBox
                          key={`${reading.video}${reading.t}`}
                          accessibilityRole="button"
                          onPress={() =>
                            openMoment({
                              video: reading.video,
                              t: reading.t,
                              note: reading.url ?? undefined,
                            })
                          }
                          className="flex-row items-start gap-[8px]"
                        >
                          <FeatherIcon name="play-circle" size={16} color="primary" />
                          <Box className="flex-[1]">
                            <Text className="text-[14px]">{reading.title}</Text>
                            <Text className="text-grey text-[12px] mt-[2px]">
                              {[longDate(reading.date), reading.teacher, `from ${reading.ts}`]
                                .filter(Boolean)
                                .join(' · ')}
                            </Text>
                          </Box>
                        </TouchableBox>
                      ))}
                    </VStack>
                  )}
                  <VStack
                    className="mt-[14px] pt-[14px] gap-[14px] border-separator"
                    style={{ borderTopWidth: StyleSheet.hairlineWidth }}
                  >
                    {page.text
                      .split(/\n{2,}/u)
                      .map(paragraph => paragraph.trim())
                      .filter(Boolean)
                      .map((paragraph, i) => (
                        <LinkedParagraph key={i} text={paragraph} onOsis={openOsis} />
                      ))}
                  </VStack>
                </Card>
              )
            }}
          />
        ) : (
          <Box className="py-[60px] px-[20px] items-center">
            <Text className="text-grey text-center">
              This chapter did not load. Check your connection.
            </Text>
          </Box>
        )}
      </Box>
    </FormSheetScreen>
  )
}

export default BookChapterScreen
