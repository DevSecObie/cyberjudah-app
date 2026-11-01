import { useQuery } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { FlatList } from 'react-native'
import Header from '~common/Header'
import Loading from '~common/Loading'
import Box, { SafeAreaBox, TouchableBox, VStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { byClassUse, dataUrl, loadLibrary, type LibraryRow } from './booksData'

const bookLine = (book: LibraryRow) =>
  [
    [book.author, book.year].filter(Boolean).join(', '),
    book.volumes > 1 ? `${book.volumes} volumes` : '',
    book.classes
      ? `read in ${book.classes} ${book.classes === 1 ? 'class' : 'classes'}`
      : `${book.pages} pages`,
  ]
    .filter(Boolean)
    .join(' · ')

/** The books the classes read from, the most read first, each opening its page. */
const BooksScreen = () => {
  const router = useRouter()
  const library = useQuery({
    queryKey: ['cyberjudah-library'],
    queryFn: () => loadLibrary(),
    staleTime: 60 * 60 * 1000,
    networkMode: 'always',
    retry: 1,
  })
  const books = library.data ? byClassUse(library.data) : []

  return (
    <SafeAreaBox className="overflow-hidden border-continuous bg-reverse">
      <Header hasBackButton title="Books" />
      {library.isPending ? (
        <Loading />
      ) : books.length ? (
        <FlatList
          data={books}
          keyExtractor={book => book.slug}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}
          ListHeaderComponent={
            <Text className="text-grey text-[14px] pt-[16px] pb-[8px]">
              The books the classes read from, page by page as printed, with every moment a class
              read from them.
            </Text>
          }
          ListFooterComponent={
            <Text className="text-grey text-[12px] pt-[16px]">
              Every book here is in the public domain, from the original printing.
            </Text>
          }
          renderItem={({ item: book }) => (
            <TouchableBox
              accessibilityRole="button"
              accessibilityLabel={`${book.title}, ${bookLine(book)}`}
              onPress={() =>
                router.push({ pathname: '/(explore)/book', params: { slug: book.slug } })
              }
              className="flex-row items-center gap-[14px] py-[12px] border-b-[1px] border-border"
            >
              <Box className="w-[52px] h-[72px] rounded-[6px] overflow-hidden bg-light-grey">
                {book.cover ? (
                  <Image
                    source={{ uri: dataUrl(book.cover) }}
                    style={{ width: 52, height: 72 }}
                    contentFit="cover"
                    accessible={false}
                  />
                ) : null}
              </Box>
              <VStack className="flex-[1] gap-[3px]">
                <Text className="text-[16px] font-medium" numberOfLines={2}>
                  {book.title}
                </Text>
                <Text className="text-grey text-[13px]" numberOfLines={2}>
                  {bookLine(book)}
                </Text>
              </VStack>
              <FeatherIcon name="chevron-right" size={18} color="tertiary" />
            </TouchableBox>
          )}
        />
      ) : (
        <Box className="py-[60px] px-[20px] items-center">
          <Text className="text-grey text-center">
            The books did not load. Check your connection.
          </Text>
        </Box>
      )}
    </SafeAreaBox>
  )
}

export default BooksScreen
