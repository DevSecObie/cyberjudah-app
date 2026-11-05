// Books, laid out as Bible Strong's commentary library (CommentaryLibraryScreen): FiltersHeader
// with its search, a section title on the canvas, the rows in one rounded card split by
// hairlines that start where the text starts. Only the data is ours: a cover where Bible Strong
// shows the author's portrait.
import { useQuery } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import React from 'react'
import { SectionList, TouchableOpacity } from 'react-native'
import PanelSearch from '~common/ContextualPanel/PanelSearch'
import FiltersHeader from '~common/FiltersHeader'
import Loading from '~common/Loading'
import { openInApp } from '~common/inAppBrowser'
import Box, { TouchableBox, VStack, usePageBottomInset } from '~common/ui/Box'
import Card from '~common/ui/Card'
import { twMerge } from '~common/ui/classNames'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import { FeatherIcon } from '~common/ui/Icon'
import { ListSectionTitle, ListSeparator } from '~common/ui/ListSection'
import { pageContentStyle } from '~common/ui/PageContent'
import Text from '~common/ui/Text'
import { useOpenSiteLink } from '~features/publishedNotes/siteLinks'
import {
  amazonSearchUrl,
  byClassUse,
  dataUrl,
  IN_PRINT_BOOKS,
  loadLibrary,
  type LibraryRow,
} from './booksData'

const ROW_PADDING = 14
const COVER_WIDTH = 48
const COVER_GAP = 13
/** Where a row's text starts, so the hairline between two rows starts there too. */
const ROW_TEXT_INSET = ROW_PADDING + COVER_WIDTH + COVER_GAP

const bookLine = (book: LibraryRow) =>
  book.subtitle || [book.author, book.year].filter(Boolean).join(', ')

/** A row of the library, as Bible Strong's CommentaryLibraryItem. */
const BookRow = ({ book, onOpen }: { book: LibraryRow; onOpen: () => void }) => (
  <Box
    className="border-continuous overflow-hidden min-h-[78px] py-[11px] flex-row items-center"
    style={{ paddingLeft: ROW_PADDING, paddingRight: ROW_PADDING }}
  >
    <TouchableOpacity
      style={{ flex: 1 }}
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${book.title}, ${bookLine(book)}`}
    >
      <Box className="overflow-hidden border-continuous flex-row items-center">
        <Box
          className="rounded-[8px] overflow-hidden bg-canvas"
          style={{ width: COVER_WIDTH, height: 64 }}
        >
          {book.cover ? (
            <Image
              source={{ uri: dataUrl(book.cover) }}
              style={{ width: COVER_WIDTH, height: 64 }}
              contentFit="cover"
              accessible={false}
            />
          ) : null}
        </Box>
        <Box
          className="overflow-hidden border-continuous flex-[1]"
          style={{ marginLeft: COVER_GAP }}
        >
          <Text className="font-bold text-[16px]" numberOfLines={2}>
            {book.title}
          </Text>
          <Text className="mt-[3px] text-grey text-[12px]" numberOfLines={2}>
            {bookLine(book)}
          </Text>
        </Box>
      </Box>
    </TouchableOpacity>
  </Box>
)

/** Books still in print that the classes used: where they were used, and where to buy them. */
const InPrint = ({ query }: { query: string }) => {
  const { openMoment } = useOpenSiteLink()
  const books = IN_PRINT_BOOKS.filter(
    book => !query || `${book.title} ${book.note}`.toLocaleLowerCase().includes(query)
  )
  if (!books.length) return null
  return (
    <VStack className="mx-[20px] mb-[22px]">
      <ListSectionTitle className="mx-[4px]">In print</ListSectionTitle>
      <Text className="text-grey text-[13px] mx-[4px] mb-[10px]">
        Modern books the classes used. They are not copied here; buy them from the seller.
      </Text>
      <VStack className="gap-[12px]">
        {books.map(book => (
          <Card key={book.title} className="px-[16px] py-[14px] gap-[8px]">
            <Text className="font-bold text-[16px]">{book.title}</Text>
            <Text className="text-grey text-[13px]">{book.note}</Text>
            {book.moments.map(moment => (
              <TouchableBox
                key={`${moment.video}${moment.t}`}
                accessibilityRole="button"
                onPress={() => openMoment({ video: moment.video, t: moment.t })}
                className="flex-row items-center gap-[8px]"
              >
                <FeatherIcon name="play-circle" size={16} color="primary" />
                <Text className="text-link text-[13px]">
                  {moment.said} · from {moment.ts}
                </Text>
              </TouchableBox>
            ))}
            <TouchableBox
              accessibilityRole="link"
              accessibilityHint="Opens Amazon"
              onPress={() => openInApp(amazonSearchUrl(book.title))}
              className="self-start flex-row items-center gap-[8px] rounded-full bg-light-primary px-[12px] py-[6px] mt-[4px]"
            >
              <FeatherIcon name="shopping-cart" size={14} color="primary" />
              <Text className="text-link text-[13px]">Buy on Amazon</Text>
            </TouchableBox>
          </Card>
        ))}
      </VStack>
    </VStack>
  )
}

/** The books the classes read from, the most read first, each opening its page. */
const BooksScreen = () => {
  const router = useRouter()
  const bottomInset = usePageBottomInset()
  const [query, setQuery] = React.useState('')
  const library = useQuery({
    queryKey: ['cyberjudah-library'],
    queryFn: () => loadLibrary(),
    staleTime: 60 * 60 * 1000,
    networkMode: 'always',
    retry: 1,
  })
  const normalized = query.trim().toLocaleLowerCase()
  const books = (library.data ? byClassUse(library.data) : []).filter(
    book =>
      !normalized ||
      [book.title, book.subtitle, book.author].join(' ').toLocaleLowerCase().includes(normalized)
  )
  const sections = books.length ? [{ title: 'Library', data: books }] : []

  return (
    <FormSheetScreen className="bg-canvas" isFormSheet={false}>
      <Box className="overflow-hidden border-continuous flex-[1] bg-canvas">
        <FiltersHeader
          title="Books"
          hasBackButton
          onReset={() => setQuery('')}
          filters={[
            {
              key: 'search',
              icon: 'search',
              label: 'Search',
              value: query.trim() || undefined,
              active: Boolean(query.trim()),
              onPress: () => {},
              content: () => <PanelSearch value={query} onChange={setQuery} />,
            },
          ]}
        />
        {library.isPending ? (
          <Loading />
        ) : library.data ? (
          <SectionList<LibraryRow>
            sections={sections}
            stickySectionHeadersEnabled={false}
            keyExtractor={book => book.slug}
            contentContainerStyle={[
              pageContentStyle,
              { paddingTop: 16, paddingBottom: bottomInset + 20 },
            ]}
            renderSectionHeader={({ section }) => (
              <ListSectionTitle className="mx-[24px]">{section.title}</ListSectionTitle>
            )}
            renderItem={({ item, index, section }) => {
              const isFirst = index === 0
              const isLast = index === section.data.length - 1
              // Each row is one slice of the library's card: the first and the last round it.
              return (
                <Box
                  className={twMerge(
                    'border-continuous mx-[20px] bg-surface',
                    isFirst && 'rounded-t-[16px] overflow-hidden',
                    isLast && 'rounded-b-[16px] overflow-hidden mb-[22px]'
                  )}
                >
                  {!isFirst && <ListSeparator inset={ROW_TEXT_INSET} />}
                  <BookRow
                    book={item}
                    onOpen={() =>
                      router.push({ pathname: '/(explore)/book', params: { slug: item.slug } })
                    }
                  />
                </Box>
              )
            }}
            ListFooterComponent={<InPrint query={normalized} />}
          />
        ) : (
          <Box className="py-[60px] px-[20px] items-center">
            <Text className="text-grey text-center">
              The books did not load. Check your connection.
            </Text>
          </Box>
        )}
      </Box>
    </FormSheetScreen>
  )
}

export default BooksScreen
