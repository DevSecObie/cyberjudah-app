import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Linking, useWindowDimensions } from 'react-native'
import YoutubePlayer from '~helpers/react-native-youtube-iframe'
import WebView from 'react-native-webview'
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes'
import Header from '~common/Header'
import Box, { VStack } from '~common/ui/Box'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import ScrollView from '~common/ui/ScrollView'
import Text from '~common/ui/Text'
import {
  formatPassageMediaDuration,
  getPassageMediaById,
  getPassageMediaEmbedUrl,
} from '~features/bible/passageMedia'
import { IS_FORM_SHEET } from '~helpers/constants'
import useLanguage from '~helpers/useLanguage'
import { useQuery } from '@tanstack/react-query'
import { getCommentaryBibleViewRoute } from '~features/commentaries/commentaryReferenceNavigation'
import ClassNotesView from './ClassNotesView'
import ClassNotesPdfButton from '~features/notesExport/ClassNotesPdfButton'
import { usesCyberJudahEditorial } from '~helpers/editorialProfile'
import { CLASS_SEEK_PREFIX, getCachedClassById, loadClassNotes } from './cyberJudahClasses'
const YOUTUBE_PLAYER_BASE_URL =
  'https://lonelycpp.github.io/react-native-youtube-iframe/iframe_v2.html'

const PassageMediaPlayerScreen = () => {
  const stylingTheme = useStylingTheme()

  const { t } = useTranslation()
  const { workId, language: requestedLanguage } = useLocalSearchParams<{
    workId?: string
    language?: string
  }>()
  const preferredLanguage = useLanguage()
  const language =
    requestedLanguage === 'fr' || requestedLanguage === 'en' ? requestedLanguage : preferredLanguage
  const { width: windowWidth } = useWindowDimensions()
  const [playerError, setPlayerError] = useState<string>()
  const classPlayerRef = useRef<WebView>(null)
  const router = useRouter()
  const item = workId ? (getPassageMediaById(workId, language) ?? getCachedClassById(workId)) : null
  const notesPath = item && 'notesPath' in item ? String(item.notesPath) : ''
  const notes = useQuery({
    queryKey: ['cyberjudah-class-notes', notesPath],
    queryFn: () => loadClassNotes(notesPath, item?.providerId ?? ''),
    enabled: !!notesPath,
    staleTime: 60 * 60 * 1000,
    networkMode: 'always',
    retry: 1,
  })
  const playerWidth = Math.min(windowWidth - 32, 720)
  const playerHeight = (playerWidth * 9) / 16

  return (
    <FormSheetScreen isFormSheet={IS_FORM_SHEET}>
      <Box className="overflow-hidden border-continuous flex-[1] bg-reverse">
        <Header
          background
          title={item?.title ?? t('passageMediaLibrary.playerTitle')}
          rightComponent={notesPath ? <ClassNotesPdfButton notesPath={notesPath} /> : undefined}
        />
        {item ? (
          <>
            <Box className="items-center px-[16px] pt-[16px] pb-[12px] bg-reverse border-b-[1px] border-border">
              <VStack
                className="overflow-hidden border-continuous gap-[18px]"
                style={{ width: playerWidth }}
              >
                <Box
                  className="border-continuous overflow-hidden rounded-[14px] border-[1px] border-border bg-light-grey"
                  style={{
                    width: playerWidth,
                    height: playerHeight,
                    shadowColor: 'rgb(89,131,240)',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 7,
                    elevation: 1,
                    overflow: 'visible',
                  }}
                >
                  {usesCyberJudahEditorial() ? (
                    // Like the reader's player (and Bible Strong's), the class plays inside
                    // CyberJudah's hosted video page: YouTube refuses embeds from an inline page.
                    <WebView
                      ref={classPlayerRef}
                      source={{ uri: getPassageMediaEmbedUrl(item.providerId) }}
                      style={{ width: playerWidth, height: playerHeight, borderRadius: 14 }}
                      allowsInlineMediaPlayback
                      allowsFullscreenVideo
                      mediaPlaybackRequiresUserAction={false}
                      onError={() => setPlayerError('unavailable')}
                    />
                  ) : (
                    <YoutubePlayer
                      height={playerHeight}
                      width={playerWidth}
                      videoId={item.providerId}
                      play
                      onError={error => {
                        console.log('[PassageMediaPlayer] error', item.providerId, error)
                        setPlayerError(error || 'unknown')
                      }}
                      onReady={() => setPlayerError(undefined)}
                      initialPlayerParams={{ rel: false }}
                      webViewProps={{
                        onShouldStartLoadWithRequest: (request: ShouldStartLoadRequest) => {
                          const url = request.mainDocumentURL || request.url
                          return url === 'about:blank' || url.startsWith(YOUTUBE_PLAYER_BASE_URL)
                        },
                      }}
                      viewContainerStyle={{ borderRadius: 14, overflow: 'hidden' }}
                      webViewStyle={{ borderRadius: 14, overflow: 'hidden' }}
                    />
                  )}
                </Box>
                <VStack className="overflow-hidden border-continuous gap-[7px] px-[2px]">
                  <Text
                    className="text-[22px] leading-[28px]"
                    style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
                  >
                    {item.title}
                  </Text>
                  <Text
                    className="text-grey text-[14px]"
                    style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.text) }}
                  >
                    {[
                      'subtitle' in item ? item.subtitle : undefined,
                      item.durationSeconds > 0
                        ? formatPassageMediaDuration(item.durationSeconds)
                        : undefined,
                      item.attributionLabel,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  {!!playerError && (
                    <Text
                      className="text-quart text-[14px]"
                      style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.text) }}
                    >
                      {t('passageMediaLibrary.playbackError')}
                    </Text>
                  )}
                </VStack>
              </VStack>
            </Box>
            <ScrollView
              backgroundColor="reverse"
              contentContainerStyle={{
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingTop: 16,
              }}
            >
              {!!notes.data && (
                <Box style={{ width: playerWidth }}>
                  <ClassNotesView
                    html={notes.data}
                    onLinkPress={href => {
                      if (href.startsWith(CLASS_SEEK_PREFIX)) {
                        const seconds = Number(href.slice(CLASS_SEEK_PREFIX.length))
                        // Restart the class's own player at that moment.
                        classPlayerRef.current?.injectJavaScript(`(() => {
                          const frame = document.querySelector('iframe')
                          if (!frame) return
                          const url = new URL(frame.src)
                          url.searchParams.set('start', '${seconds}')
                          url.searchParams.set('autoplay', '1')
                          frame.src = url.toString()
                        })(); true`)
                      } else if (href.startsWith('bible://')) {
                        const route = getCommentaryBibleViewRoute(href.slice('bible://'.length))
                        if (route) router.push(route)
                      } else if (/^https:\/\//.test(href)) {
                        void Linking.openURL(href)
                      }
                    }}
                  />
                </Box>
              )}
            </ScrollView>
          </>
        ) : (
          <Box className="overflow-hidden border-continuous py-[60px] px-[20px] items-center justify-center">
            <Text className="text-grey text-center">{t('passageMediaLibrary.notFound')}</Text>
          </Box>
        )}
      </Box>
    </FormSheetScreen>
  )
}

export default PassageMediaPlayerScreen
