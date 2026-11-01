import { useQuery } from '@tanstack/react-query'
import { useLocalSearchParams } from 'expo-router'
import { FlatList } from 'react-native'
import { openInApp } from '~common/inAppBrowser'
import Header from '~common/Header'
import Loading from '~common/Loading'
import Box, { HStack, TouchableBox, VStack, SafeAreaBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { longDate } from '~features/notesExport/notePdf'
import { useOpenSiteLink } from '~features/publishedNotes/siteLinks'
import { resolveFontFamily } from '~themes/styleValues'
import { useTheme } from '~themes/ThemeProvider'
import { loadBook, loadBookChapter, pageLabel, scanUrl } from './booksData'

/** A chapter of a book, page by page as printed, each page with the classes that read it. */
const BookChapterScreen = () => {
  const theme = useTheme()
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

  return (
    <SafeAreaBox className="overflow-hidden border-continuous bg-reverse">
      <Header hasBackButton title={book.data?.title ?? title} />
      {chapter.isPending ? (
        <Loading />
      ) : data ? (
        <FlatList
          data={data.pages}
          keyExtractor={page => `${page.vol}-${page.page}`}
          contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
          ListHeaderComponent={
            <Text
              className="text-[24px] leading-[30px] mb-[8px]"
              style={{ fontFamily: resolveFontFamily(theme.fontFamily.title) }}
            >
              {title}
            </Text>
          }
          renderItem={({ item: page }) => {
            const scan = scanUrl(book.data?.scan ?? '', data.item, page.img)
            return (
              <VStack className="pt-[18px] mt-[18px] border-t-[1px] border-border gap-[10px]">
                <HStack className="items-center justify-between">
                  <Text className="text-primary text-[13px] font-bold">
                    {pageLabel({ volumes }, page.vol, page.page)}
                  </Text>
                  {scan ? (
                    <TouchableBox accessibilityRole="link" onPress={() => openInApp(scan)}>
                      <Text className="text-primary text-[13px]">Printed page</Text>
                    </TouchableBox>
                  ) : null}
                </HStack>
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
                    className="rounded-[10px] px-[12px] py-[8px]"
                    style={{ backgroundColor: 'rgba(89, 131, 240, 0.08)' }}
                  >
                    <Text className="text-primary text-[12px] font-bold">
                      Read in class ·{' '}
                      {[longDate(reading.date), reading.teacher, `from ${reading.ts}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                    <Text className="text-[14px]">{reading.title}</Text>
                  </TouchableBox>
                ))}
                <Text selectable className="text-[16px] leading-[25px]">
                  {page.text}
                </Text>
              </VStack>
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
    </SafeAreaBox>
  )
}

export default BookChapterScreen
