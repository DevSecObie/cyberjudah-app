import { useQueries } from '@tanstack/react-query'
import { usePathname, useGlobalSearchParams } from 'expo-router'
import { useSetAtom } from 'jotai'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Linking, ScrollView as NativeScrollView } from 'react-native'
import Loading from '~common/Loading'
import SwitchableHTMLView from '~common/SwitchableHTMLView'
import Box, { TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { COMMENTARY_CATALOG, type CommentaryCatalogEntry } from '~helpers/commentaryCatalog'
import { dockedClassAtom, youtubeIdOf } from '~features/passageMediaLibrary/dockedClassPlayerStore'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import CommentaryAvatar from './CommentaryAvatar'
import { splitCommentaryClassLine } from './commentaryClassLine'
import { getCommentaryBibleViewRoute } from './commentaryReferenceNavigation'
import { commentaryHrefToOsis } from './commentaryResourceParams'

/** The Bishops' own commentaries, one per Bishop (ids "bishop-…"). */
export const isBishopCommentary = (resourceId: string) => resourceId.startsWith('bishop-')

/**
 * What the Bishops taught on one verse (Obie, 2026-11-02: look B with look A inside): a tab for
 * each Bishop who taught it, and under it a card for each class, newest first, headed by the
 * class, its date and a play button that opens the class at that moment in the app's player.
 */
export default function BishopsVerseCommentary({
  book,
  chapter,
  verse,
  initialResourceId,
}: {
  book: number
  chapter: number
  verse: number
  initialResourceId: string
}) {
  const { t } = useTranslation()
  const resources = useResourceAccess()
  const pushRouteOnce = usePushRouteOnce()
  const setDockedClass = useSetAtom(dockedClassAtom)
  const pathname = usePathname()
  const routeParams = useGlobalSearchParams()
  const bishops = COMMENTARY_CATALOG.filter(entry => isBishopCommentary(entry.id))
  const chapters = useQueries({
    queries: bishops.map(entry => ({
      queryKey: ['commentary-resource-chapter', `${entry.id}:en`, book, chapter],
      queryFn: () =>
        resources.commentary.loadResourceChapter({
          resourceId: entry.id,
          language: 'en' as const,
          book,
          chapter,
        }),
      networkMode: 'always' as const,
      retry: false,
    })),
  })
  const taught = bishops
    .map((entry, i) => ({
      entry,
      sections: (chapters[i].data?.sections ?? []).filter(
        section => section.rangeStartVerse <= verse && verse <= section.rangeEndVerse
      ),
    }))
    .filter(row => row.sections.length > 0)
  const [selected, setSelected] = useState(initialResourceId)
  const current = taught.find(row => row.entry.id === selected) ?? taught[0]
  const loading = chapters.some(query => query.isPending)

  const openLink = (href: string) => {
    const osis = commentaryHrefToOsis(href)
    const route = osis ? getCommentaryBibleViewRoute(osis) : undefined
    if (route) return pushRouteOnce(route)
    const videoId = youtubeIdOf(href)
    if (videoId) {
      const start = Number(/[?&]t=(\d+)/.exec(href)?.[1] ?? 0)
      return play(videoId, start, current?.entry.shortName ?? '')
    }
    if (/^https?:\/\//iu.test(href)) void Linking.openURL(href)
  }
  const play = (videoId: string, start: number, title: string) =>
    setDockedClass({
      videoId,
      title,
      // The moment he taught this verse, not where the class was last left.
      start,
      returnTo: { pathname, params: routeParams as Record<string, string | string[]> },
    })

  if (!current) {
    return loading ? (
      <Box className="items-center justify-center py-[40px]">
        <Loading />
      </Box>
    ) : (
      <Text className="text-tertiary text-[15px]">{t('commentaries.bishops.none')}</Text>
    )
  }

  return (
    <Box className="gap-[16px]">
      <NativeScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Box accessibilityRole="tablist" className="flex-row gap-[8px]">
          {taught.map(({ entry }) => (
            <BishopTab
              key={entry.id}
              entry={entry}
              selected={entry.id === current.entry.id}
              onPress={() => setSelected(entry.id)}
            />
          ))}
        </Box>
      </NativeScrollView>
      {current.sections.map(section => {
        const { body, classTitle, date, video } = splitCommentaryClassLine(section.content)
        return (
          <Box
            key={section.id}
            className="bg-reverse rounded-[20px] px-[18px] py-[16px] gap-[6px]"
            style={{
              shadowColor: 'rgb(89,131,240)',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 7,
              elevation: 1,
            }}
          >
            <Box className="flex-row items-center gap-[12px]">
              <Box className="flex-[1] gap-[2px]">
                {!!classTitle && (
                  <Text className="text-[15px] leading-[20px] font-bold">{classTitle}</Text>
                )}
                {!!date && <Text className="text-tertiary text-[13px]">{date}</Text>}
              </Box>
              {video && (
                <TouchableBox
                  accessibilityRole="button"
                  accessibilityLabel={t('commentaries.bishops.play', { time: video.label })}
                  onPress={() => play(video.id, video.start, classTitle ?? current.entry.shortName)}
                  className="flex-row items-center gap-[6px] bg-primary rounded-full px-[12px] min-h-[36px]"
                >
                  <Text className="text-reverse text-[12px]">{'▶'}</Text>
                  <Text
                    className="text-reverse text-[13px] font-bold"
                    style={{ fontVariant: ['tabular-nums'] }}
                  >
                    {video.label}
                  </Text>
                </TouchableBox>
              )}
            </Box>
            <SwitchableHTMLView selectable value={body} onLinkPress={openLink} />
          </Box>
        )
      })}
    </Box>
  )
}

function BishopTab({
  entry,
  selected,
  onPress,
}: {
  entry: CommentaryCatalogEntry
  selected: boolean
  onPress: () => void
}) {
  return (
    <TouchableBox
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`flex-row items-center gap-[8px] rounded-full pl-[4px] pr-[14px] min-h-[44px] border-[1px] ${
        selected ? 'bg-default border-default' : 'bg-reverse border-border'
      }`}
    >
      <CommentaryAvatar
        resourceCode={entry.id}
        author={entry.author}
        fallback={entry.shortName}
        size={34}
      />
      <Text className={`text-[14px] font-bold ${selected ? 'text-reverse' : 'text-default'}`}>
        {entry.shortName}
      </Text>
    </TouchableBox>
  )
}
