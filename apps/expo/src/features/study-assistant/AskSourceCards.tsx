import { useState } from 'react'
import { Pressable, ScrollView } from 'react-native'
import { Image } from 'expo-image'
import { useTranslation } from 'react-i18next'
import Box, { HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { sourceLink, timestamp, type CyberJudahSource } from './cyberJudahAsk'
import { sourceThumbnails } from './cyberJudahSourceArtwork'
import { CYBERJUDAH_PORTRAITS } from '~features/lexique/cyberJudahPortraits'
import { useOpenStudySource } from './useOpenStudySource'
import { useAskPalette } from './askPalette'

function portrait(source: CyberJudahSource) {
  const id = /^\/(?:person)\/([a-z0-9-]+)$/.exec(source.url)?.[1]
  return id ? CYBERJUDAH_PORTRAITS[id] : undefined
}

function SourceArtwork({ source }: { source: CyberJudahSource }) {
  const local = portrait(source)
  const images = [...(local ? [local] : []), ...sourceThumbnails(source).map(uri => ({ uri }))]
  const [attempt, setAttempt] = useState(0)
  const candidate = images[attempt]
  if (!candidate) return null
  return (
    <Box className="aspect-video w-full items-center justify-center bg-light-grey">
      <Image
        key={attempt}
        source={candidate}
        style={{ width: '100%', height: '100%' }}
        contentFit="contain"
        cachePolicy="memory-disk"
        accessible={false}
        onError={() => setAttempt(value => value + 1)}
      />
    </Box>
  )
}

export default function AskSourceCards({
  sources,
  onOpenSource,
}: {
  sources: CyberJudahSource[]
  onOpenSource?: (source: CyberJudahSource) => void
}) {
  const { t } = useTranslation()
  const openSource = useOpenStudySource()
  const p = useAskPalette()
  if (!sources.length) return null
  return (
    <Box className="mt-5 gap-2">
      <Text style={{ color: p.text3, fontSize: 12, fontWeight: '700' }}>
        {t('assistant.cyberjudah.sources')} · {sources.length}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, alignItems: 'flex-start' }}
      >
        {sources.map(source => {
          const link = sourceLink(source)
          const hasArtwork = !!portrait(source) || sourceThumbnails(source).length > 0
          const moment = source.video && source.t !== undefined ? timestamp(source.t) : source.kind
          return (
            <Pressable
              key={`${source.n}:${source.video || source.url}:${source.thumb || ''}`}
              disabled={!link}
              accessibilityRole="link"
              accessibilityLabel={`${source.n}. ${source.title}${moment ? `, ${moment}` : ''}`}
              onPress={() => (onOpenSource ? onOpenSource(source) : void openSource(source))}
              className="overflow-hidden rounded-2xl"
              style={({ pressed }) => ({
                width: 220,
                backgroundColor: p.surface1,
                borderWidth: 0.5,
                borderColor: p.edge,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              {hasArtwork && <SourceArtwork source={source} />}
              <Box className="gap-2 p-3">
                <HStack className="items-center gap-[6px]">
                  <Box
                    className="h-5 min-w-5 items-center justify-center rounded-full px-[5px]"
                    style={{ backgroundColor: p.accentSoft }}
                  >
                    <Text style={{ color: p.accent, fontSize: 11, fontWeight: '700' }}>{source.n}</Text>
                  </Box>
                  <Text
                    className="flex-1"
                    numberOfLines={1}
                    style={{ color: p.text3, fontSize: 11.5, fontWeight: '500', textTransform: 'capitalize' }}
                  >
                    {moment}
                  </Text>
                </HStack>
                <Text numberOfLines={2} style={{ color: p.text1, fontSize: 15, fontWeight: '500', lineHeight: 20 }}>
                  {source.title}
                </Text>
                {!!source.excerpt && (
                  <Text numberOfLines={3} style={{ color: p.text3, fontSize: 13, lineHeight: 19 }}>
                    {source.excerpt}
                  </Text>
                )}
                {!!source.evidence && (
                  <Text className="text-xs text-grey">
                    {t(`askStudy.evidence.${source.evidence}`)}
                  </Text>
                )}
              </Box>
            </Pressable>
          )
        })}
      </ScrollView>
    </Box>
  )
}
