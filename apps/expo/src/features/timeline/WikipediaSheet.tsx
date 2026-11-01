import React, { useRef, useState } from 'react'
import { ActivityIndicator, Linking, Modal, Platform, Pressable, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import WebView from 'react-native-webview'
import { HStack } from '~common/ui/Box'
import Container from '~common/ui/Container'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useTheme } from '~themes/ThemeProvider'
import { isWikipediaUrl } from './wikipediaLinks'

// A Wikipedia page the Timeline cites, read on a page sheet inside the app instead of leaving
// for the browser. The sheet keeps to Wikipedia: a link in the page to anywhere else opens in
// the browser, and "Open in Safari" is always there for the page itself.

const titleFromUrl = (url: string) => {
  try {
    const page = new URL(url).pathname.split('/wiki/')[1]
    return page ? decodeURIComponent(page).replace(/_/g, ' ') : 'Wikipedia'
  } catch {
    return 'Wikipedia'
  }
}

const SheetButton = ({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: React.ComponentProps<typeof FeatherIcon>['name']
  label: string
  onPress: () => void
  disabled?: boolean
}) => {
  const theme = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      className="h-11 w-11 items-center justify-center rounded-full"
      style={({ pressed }) => ({
        backgroundColor: theme.colors.lightGrey,
        borderWidth: 1,
        borderColor: theme.colors.border,
        opacity: disabled ? 0.35 : pressed ? 0.6 : 1,
      })}
    >
      <FeatherIcon name={icon} size={20} />
    </Pressable>
  )
}

const WikipediaSheet = ({ url, onClose }: { url?: string; onClose: () => void }) => {
  const { t } = useTranslation()
  const webView = useRef<{ goBack: () => void } | null>(null)
  const [pageUrl, setPageUrl] = useState(url)
  const [title, setTitle] = useState<string>()
  const [canGoBack, setCanGoBack] = useState(false)
  const [loading, setLoading] = useState(true)

  // A new link starts the sheet afresh.
  const [shownUrl, setShownUrl] = useState(url)
  if (url !== shownUrl) {
    setShownUrl(url)
    setPageUrl(url)
    setTitle(undefined)
    setCanGoBack(false)
    setLoading(true)
  }

  const heading = title || (pageUrl ? titleFromUrl(pageUrl) : 'Wikipedia')

  return (
    <Modal
      visible={!!url}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <Container className="bg-reverse">
        <HStack className="items-center gap-2 px-4 pb-2 pt-4">
          <SheetButton icon="x" label={t('Fermer')} onPress={onClose} />
          {canGoBack ? (
            <SheetButton
              icon="chevron-left"
              label={t('Retour')}
              onPress={() => webView.current?.goBack()}
            />
          ) : null}
          <View className="flex-1 items-center" accessible accessibilityRole="header">
            <Text numberOfLines={1} className="text-[16px] font-bold">
              {heading}
            </Text>
            <Text numberOfLines={1} className="text-grey text-[12px]">
              Wikipedia
            </Text>
          </View>
          {canGoBack ? <View className="w-11" /> : null}
          <SheetButton
            icon="compass"
            label={Platform.OS === 'ios' ? 'Open in Safari' : 'Open in browser'}
            disabled={!pageUrl}
            onPress={() => pageUrl && void Linking.openURL(pageUrl)}
          />
        </HStack>
        {url ? (
          <View style={{ flex: 1 }}>
            <WebView
              ref={webView as never}
              source={{ uri: url }}
              style={{ flex: 1 }}
              originWhitelist={['https://*', 'http://*']}
              allowsBackForwardNavigationGestures
              allowsInlineMediaPlayback
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => setLoading(false)}
              onNavigationStateChange={state => {
                setCanGoBack(state.canGoBack)
                if (state.url) setPageUrl(state.url)
                const pageTitle = state.title?.replace(/\s+[-–—]\s+Wikipedia$/u, '')
                if (pageTitle && !pageTitle.startsWith('http')) setTitle(pageTitle)
              }}
              onShouldStartLoadWithRequest={request => {
                // Pictures, maps and other parts of the page load as they are.
                if (request.isTopFrame === false) return true
                if (isWikipediaUrl(request.url) || request.url === 'about:blank') return true
                // A link off Wikipedia leaves for the browser rather than taking over the sheet.
                if (/^https?:\/\//iu.test(request.url)) void Linking.openURL(request.url)
                return false
              }}
            />
            {loading ? (
              <View
                pointerEvents="none"
                style={{ position: 'absolute', top: 24, left: 0, right: 0, alignItems: 'center' }}
              >
                <ActivityIndicator accessibilityLabel={t('Chargement...')} />
              </View>
            ) : null}
          </View>
        ) : null}
      </Container>
    </Modal>
  )
}

export default WikipediaSheet
