import { Image } from 'expo-image'
import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { Pressable, StyleSheet } from 'react-native'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { formatPassageMediaDuration, getPassageMediaEmbedUrl } from '~features/bible/passageMedia'
import ClassVideoFrame, {
  type ClassVideoFrameHandle,
} from '~features/passageMediaLibrary/ClassVideoFrame'
import { rememberClassPosition } from '~features/passageMediaLibrary/classVideoPosition'
import PipGlass from '~features/passageMediaLibrary/PipGlass'
import { type ClassMoment } from './commentaryClassMoment'

export { type ClassMoment, classMomentOf, firstClassMomentIn } from './commentaryClassMoment'

export type CommentaryClassVideoHandle = { playAt: (moment: ClassMoment) => void }

/**
 * The class an entry comes from, in the entry itself. It shows the video's picture with the
 * moment on it, and plays right there from that moment when tapped, so the class never starts
 * on its own with sound. Tapping the entry's timestamp plays it from there too.
 */
const CommentaryClassVideo = forwardRef<
  CommentaryClassVideoHandle,
  { moment: ClassMoment; title?: string }
>(({ moment, title }, ref) => {
  const [playing, setPlaying] = useState<ClassMoment | null>(null)
  const frame = useRef<ClassVideoFrameHandle>(null)

  useImperativeHandle(ref, () => ({
    playAt: next => {
      if (playing && playing.videoId === next.videoId) {
        frame.current?.command({ func: 'seekTo', args: [next.start, true] })
        frame.current?.command({ func: 'playVideo' })
      } else {
        setPlaying(next)
      }
    },
  }))

  const label = formatPassageMediaDuration(moment.start)

  return (
    <Box
      className="overflow-hidden border-continuous mt-[16px] rounded-[14px] bg-[#000]"
      style={{ width: '100%', aspectRatio: 16 / 9 }}
    >
      {playing ? (
        <ClassVideoFrame
          ref={frame}
          uri={getPassageMediaEmbedUrl(playing.videoId, playing.start)}
          onTime={seconds => rememberClassPosition(playing.videoId, seconds)}
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Play ${title ? `${title} ` : 'the class '}from ${label}`}
          onPress={() => setPlaying(moment)}
          style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.85 : 1 })}
        >
          <Image
            source={{ uri: `https://i.ytimg.com/vi/${moment.videoId}/hqdefault.jpg` }}
            accessibilityIgnoresInvertColors
            contentFit="cover"
            style={StyleSheet.absoluteFill}
          />
          <Box
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.18)' }]}
          />
          <Box pointerEvents="none" className="flex-1 items-center justify-center">
            <Box className="w-[56px] h-[56px] rounded-full items-center justify-center">
              <PipGlass radius={28} />
              <FeatherIcon name="play" size={24} color="white" style={{ marginLeft: 3 }} />
            </Box>
          </Box>
          <Box
            pointerEvents="none"
            className="absolute right-[10px] bottom-[10px] px-[8px] py-[3px] rounded-[8px]"
            style={{ backgroundColor: 'rgba(0,0,0,0.72)' }}
          >
            <Text className="text-[13px]" style={{ color: '#fff', fontVariant: ['tabular-nums'] }}>
              {label}
            </Text>
          </Box>
        </Pressable>
      )}
    </Box>
  )
})
CommentaryClassVideo.displayName = 'CommentaryClassVideo'

export default CommentaryClassVideo
