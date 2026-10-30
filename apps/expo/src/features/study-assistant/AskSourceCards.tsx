import { useState } from 'react'
import { Linking, Pressable, ScrollView } from 'react-native'
import { Image } from 'expo-image'
import { useTranslation } from 'react-i18next'
import Box, { HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { sourceLink, timestamp, type CyberJudahSource } from './cyberJudahAsk'
import { sourceThumbnails } from './cyberJudahSourceArtwork'
import { CYBERJUDAH_PORTRAITS } from '~features/lexique/cyberJudahPortraits'

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
  if (!sources.length) return null
  return (
    <Box className="mt-5 gap-2">
      <HStack className="items-center gap-2">
        <FeatherIcon name="book-open" size={14} color="grey" />
        <Text className="text-[13px] text-grey">{t('assistant.cyberjudah.sources')}</Text>
        <Text className="text-xs text-grey">{sources.length}</Text>
      </HStack>
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
              onPress={() =>
                onOpenSource
                  ? onOpenSource(source)
                  : link && void Linking.openURL(link).catch(() => {})
              }
              className="w-56 overflow-hidden rounded-2xl bg-light-grey"
              style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
            >
              {hasArtwork && <SourceArtwork source={source} />}
              <Box className="gap-2 p-3">
                <HStack className="items-center gap-2">
                  <Box className="h-8 w-8 items-center justify-center rounded-lg bg-opacity5">
                    <FeatherIcon
                      name={source.video ? 'play-circle' : 'file-text'}
                      size={14}
                      color="grey"
                    />
                  </Box>
                  <Text
                    className="flex-1 text-xs text-grey"
                    numberOfLines={1}
                    style={{ textTransform: 'capitalize' }}
                  >
                    {[source.n, moment].filter(Boolean).join(' · ')}
                  </Text>
                  <FeatherIcon name="arrow-up-right" size={14} color="grey" />
                </HStack>
                <Text numberOfLines={3} className="text-sm leading-5">
                  {source.title}
                </Text>
                {!!source.excerpt && (
                  <Text numberOfLines={4} className="text-xs leading-5 text-grey">
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
