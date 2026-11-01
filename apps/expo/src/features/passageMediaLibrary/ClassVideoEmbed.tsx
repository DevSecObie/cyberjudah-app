import { useQuery } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { atom, useAtom } from 'jotai'
import { forwardRef, useId, useImperativeHandle, useRef, useState } from 'react'
import { Pressable, StyleSheet } from 'react-native'
import Box, { TouchableBox, VStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { formatPassageMediaDuration, getPassageMediaEmbedUrl } from '~features/bible/passageMedia'
import ClassVideoFrame, { type ClassVideoFrameHandle } from './ClassVideoFrame'
import { rememberClassPosition } from './classVideoPosition'
import { loadClassLibrary, readCachedClassLibrary } from './cyberJudahClasses'
import PipGlass from './PipGlass'

export { secondsOfClock } from './classVideoPosition'

/** The one class playing inside a page; starting another puts this one back to its picture. */
const playingEmbedAtom = atom<string | null>(null)

/** The published classes, read once and shared, to find a class's video from its notes page. */
export const useClassLibrary = () =>
  useQuery({
    queryKey: ['cyberjudah-class-library'],
    queryFn: () => loadClassLibrary(),
    initialData: () => readCachedClassLibrary() ?? undefined,
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60 * 1000,
    networkMode: 'always',
    retry: 1,
  }).data

/** The YouTube video of a class, from its notes page ("/classes/…"), when the class has one. */
export const useClassVideoOf = (notesPath?: string): string | undefined => {
  const library = useClassLibrary()
  if (!notesPath) return undefined
  const path = notesPath.replace(/^https:\/\/cyberjudah\.io/u, '').replace(/[?#].*$/u, '')
  return library?.find(entry => entry.notesPath === path)?.providerId
}

export type ClassVideoEmbedHandle = { playAt: (seconds: number) => void }

type Props = {
  videoId: string
  /** The moment the class is referenced at, in seconds. */
  start?: number
  title?: string
  /** The line under the title: date, teacher, the moment. */
  meta?: string
  /** Opens the class's own page (its notes and player). */
  onOpenClass?: () => void
  /** Only the video, without the card's border and caption. */
  bare?: boolean
}

/**
 * A class video embedded where the class is referenced, as the Timeline's articles have it: the
 * video's picture with the moment on it, and its name under it. A tap plays it right there from
 * that moment, through CyberJudah's hosted video page, and it never starts on its own with sound.
 * Only one plays at a time, and the playing time is kept like every other class player.
 */
const ClassVideoEmbed = forwardRef<ClassVideoEmbedHandle, Props>(
  ({ videoId, start = 0, title, meta, onOpenClass, bare }, ref) => {
    const id = useId()
    const [playingId, setPlayingId] = useAtom(playingEmbedAtom)
    const [startAt, setStartAt] = useState(start)
    const frame = useRef<ClassVideoFrameHandle>(null)
    const playing = playingId === id

    useImperativeHandle(ref, () => ({
      playAt: seconds => {
        if (playing) {
          frame.current?.command({ func: 'seekTo', args: [seconds, true] })
          frame.current?.command({ func: 'playVideo' })
        } else {
          setStartAt(seconds)
          setPlayingId(id)
        }
      },
    }))

    const label = start > 0 ? formatPassageMediaDuration(start) : undefined
    const video = (
      <Box
        className={`overflow-hidden border-continuous bg-[#000] ${bare ? 'rounded-[14px]' : ''}`}
        style={{ width: '100%', aspectRatio: 16 / 9 }}
      >
        {playing ? (
          <ClassVideoFrame
            ref={frame}
            uri={getPassageMediaEmbedUrl(videoId, startAt)}
            onTime={seconds => rememberClassPosition(videoId, seconds)}
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Play ${title ?? 'the class'}${label ? ` from ${label}` : ''}`}
            onPress={() => {
              setStartAt(start)
              setPlayingId(id)
            }}
            style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.85 : 1 })}
          >
            <Image
              source={{ uri: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` }}
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
            {!!label && (
              <Box
                pointerEvents="none"
                className="absolute right-[10px] bottom-[10px] px-[8px] py-[3px] rounded-[8px]"
                style={{ backgroundColor: 'rgba(0,0,0,0.72)' }}
              >
                <Text
                  className="text-[13px]"
                  style={{ color: '#fff', fontVariant: ['tabular-nums'] }}
                >
                  {label}
                </Text>
              </Box>
            )}
          </Pressable>
        )}
      </Box>
    )

    if (bare) return video

    const caption = (
      <VStack className="flex-[1] gap-[3px]">
        {!!title && (
          <Text className="text-[15px] font-bold" numberOfLines={2}>
            {title}
          </Text>
        )}
        {!!meta && <Text className="text-grey text-[13px]">{meta}</Text>}
      </VStack>
    )
    return (
      <Box className="overflow-hidden border-continuous rounded-[14px] border-[1px] border-border bg-light-grey">
        {video}
        {(title || meta) &&
          (onOpenClass ? (
            <TouchableBox
              accessibilityRole="link"
              accessibilityHint="Opens the class and its notes"
              onPress={onOpenClass}
              className="flex-row items-center gap-[8px] px-[14px] py-[10px]"
            >
              {caption}
              <FeatherIcon name="chevron-right" size={18} color="tertiary" />
            </TouchableBox>
          ) : (
            <Box className="px-[14px] py-[10px]">{caption}</Box>
          ))}
      </Box>
    )
  }
)
ClassVideoEmbed.displayName = 'ClassVideoEmbed'

export default ClassVideoEmbed
