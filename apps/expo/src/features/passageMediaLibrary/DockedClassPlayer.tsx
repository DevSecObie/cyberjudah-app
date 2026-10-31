import { useAtom } from 'jotai'
import { useState } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { getPassageMediaEmbedUrl } from '~features/bible/passageMedia'
import ClassVideoFrame from './ClassVideoFrame'
import { dockedClassAtom } from './dockedClassPlayerStore'

/**
 * The class video docked at the bottom of the app: it keeps playing while the reader opens the
 * chapters or moves anywhere else. Small by default, it grows on demand and closes with ✕.
 * The frame stays mounted when it grows or shrinks, so playback never restarts.
 */
const DockedClassPlayer = () => {
  const [docked, setDocked] = useAtom(dockedClassAtom)
  const [expanded, setExpanded] = useState(false)
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  if (!docked) return null

  const cardWidth = Math.min(width - 24, 520)
  const videoWidth = expanded ? cardWidth - 20 : 132
  const close = () => {
    setExpanded(false)
    setDocked(null)
  }

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 12, alignItems: 'center' }}
    >
      <Box
        className="bg-reverse rounded-[18px] p-[10px]"
        style={{
          width: cardWidth,
          gap: 10,
          flexDirection: expanded ? 'column' : 'row',
          alignItems: expanded ? 'stretch' : 'center',
          shadowColor: 'rgb(20,40,90)',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.22,
          shadowRadius: 18,
          elevation: 8,
        }}
      >
        <Box
          style={{
            width: videoWidth,
            height: (videoWidth * 9) / 16,
            borderRadius: 12,
            overflow: 'hidden',
            backgroundColor: '#000',
          }}
        >
          <ClassVideoFrame
            key={docked.videoId}
            uri={getPassageMediaEmbedUrl(docked.videoId, docked.start)}
          />
        </Box>
        <Box className="flex-row items-center gap-[8px]" style={{ flex: expanded ? undefined : 1 }}>
          <Box className="flex-1 gap-[3px]">
            <Text className="text-default font-bold text-[14px]" numberOfLines={1}>
              {docked.title}
            </Text>
            <Text className="text-grey text-[12px]" numberOfLines={1}>
              Playing while you read
            </Text>
          </Box>
          <TouchableBox
            accessibilityRole="button"
            accessibilityLabel={expanded ? 'Make the video smaller' : 'Make the video bigger'}
            onPress={() => setExpanded(value => !value)}
            className="w-[38px] h-[38px] rounded-full bg-light-grey items-center justify-center"
          >
            <FeatherIcon name={expanded ? 'minimize-2' : 'maximize-2'} size={16} color="primary" />
          </TouchableBox>
          <TouchableBox
            accessibilityRole="button"
            accessibilityLabel="Close the video"
            onPress={close}
            className="w-[34px] h-[34px] items-center justify-center"
          >
            <FeatherIcon name="x" size={18} color="grey" />
          </TouchableBox>
        </Box>
      </Box>
    </View>
  )
}

export default DockedClassPlayer
