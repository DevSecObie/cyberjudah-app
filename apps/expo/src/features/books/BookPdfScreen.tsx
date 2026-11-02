import { useQuery } from '@tanstack/react-query'
import { useLocalSearchParams } from 'expo-router'
import { useMemo, useState } from 'react'
import WebView from 'react-native-webview'
import Header from '~common/Header'
import Loading from '~common/Loading'
import Box, { SafeAreaBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import { API_ORIGIN, loadBookPdf } from './booksData'
import { bookPdfHtml } from './bookPdfHtml'

/**
 * A public-domain book's PDF, read in the app: it opens at the printed page asked for (the page
 * a class read), and loads only the pages near the screen.
 */
const BookPdfScreen = () => {
  const { colorScheme } = useCurrentThemeSelector()
  const {
    slug = '',
    item = '',
    printed,
    title,
  } = useLocalSearchParams<{ slug?: string; item?: string; printed?: string; title?: string }>()
  const printedPage = printed && /^\d+$/.test(printed) ? Number(printed) : undefined
  const [position, setPosition] = useState<{ page: number; pages: number }>()
  const link = useQuery({
    queryKey: ['cyberjudah-book-pdf', slug, item, printedPage],
    queryFn: () => loadBookPdf(slug, item, printedPage),
    enabled: !!slug && !!item,
    // The link is signed for a while; a fresh one each visit.
    staleTime: 5 * 60 * 1000,
    networkMode: 'always',
    retry: 1,
  })
  const html = useMemo(
    () =>
      link.data
        ? bookPdfHtml({
            url: link.data.url,
            page: link.data.page ?? 1,
            dark: colorScheme === 'dark',
          })
        : undefined,
    [link.data, colorScheme]
  )

  return (
    <SafeAreaBox className="overflow-hidden border-continuous bg-reverse">
      <Header
        hasBackButton
        title={
          position
            ? `${title ?? 'Book'} · ${position.page} of ${position.pages}`
            : (title ?? 'Book')
        }
      />
      {link.isPending ? (
        <Loading />
      ) : html ? (
        <WebView
          // Served as the server's own page, so the PDF is read from the same place.
          source={{ html, baseUrl: `${API_ORIGIN}/` }}
          originWhitelist={['https://*']}
          style={{ flex: 1, backgroundColor: 'transparent' }}
          allowsBackForwardNavigationGestures={false}
          onShouldStartLoadWithRequest={request =>
            request.url === `${API_ORIGIN}/` || request.url.startsWith('about:')
          }
          onMessage={event => {
            try {
              const message = JSON.parse(event.nativeEvent.data) as {
                page?: number
                pages?: number
              }
              if (message.page && message.pages)
                setPosition({ page: message.page, pages: message.pages })
            } catch {
              // Only the reading page posts here.
            }
          }}
        />
      ) : (
        <Box className="py-[60px] px-[20px] items-center">
          <Text className="text-grey text-center">
            This book's PDF did not open. Check your connection.
          </Text>
        </Box>
      )}
    </SafeAreaBox>
  )
}

export default BookPdfScreen
