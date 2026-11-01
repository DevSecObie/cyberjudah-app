import { useRouter } from 'expo-router'
import { useAtom } from 'jotai'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  type LayoutChangeEvent,
  PanResponder,
  Platform,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { getPassageMediaEmbedUrl } from '~features/bible/passageMedia'
import ClassVideoFrame, { type ClassVideoFrameHandle } from './ClassVideoFrame'
import FloatingLayer from './FloatingLayer'
import {
  classClock,
  classNotStarted,
  classPositionOf,
  rememberClassPosition,
} from './classVideoPosition'
import PipGlass from './PipGlass'
import { dockedClassAtom } from './dockedClassPlayerStore'

const MARGIN = 12
const MINI_WIDTH = 240
// How much of a window pushed off the side stays on screen.
const TAB_WIDTH = 28
// As in YouTube's player: a double tap on the left or right of the video skips 10 seconds.
const DOUBLE_TAP_MS = 300
const DOUBLE_TAP_SKIP = 10

type Side = 'left' | 'right'

const RoundButton = ({
  icon,
  label,
  onPress,
  size = 30,
}: {
  icon:
    | 'x'
    | 'corner-up-left'
    | 'maximize-2'
    | 'minimize-2'
    | 'play'
    | 'pause'
    | 'rotate-ccw'
    | 'rotate-cw'
  size?: number
  label: string
  onPress: () => void
}) => (
  <TouchableBox
    accessibilityRole="button"
    accessibilityLabel={label}
    onPress={onPress}
    className="rounded-full items-center justify-center"
    style={{ width: size, height: size }}
  >
    <PipGlass radius={size / 2} />
    <FeatherIcon name={icon} size={Math.round(size * 0.47)} color="white" />
  </TouchableBox>
)

/**
 * The playing time and a bar to drag through the class, as in the iPhone's and YouTube's players:
 * the time played on the left, the time left on the right. Dragging the bar takes the touch from
 * the window, so it never moves the window.
 */
const Scrubber = ({
  time,
  duration,
  onScrub,
  onSeek,
}: {
  time: number
  duration: number
  onScrub: (active: boolean) => void
  onSeek: (seconds: number) => void
}) => {
  const [width, setWidth] = useState(0)
  const [dragAt, setDragAt] = useState<number | null>(null)
  const startX = useRef(0)
  const latest = useRef({ width, duration, onScrub, onSeek })
  latest.current = { width, duration, onScrub, onSeek }
  const at = (x: number) => {
    const { width: w, duration: d } = latest.current
    return w > 0 ? Math.min(Math.max(x / w, 0), 1) * d : 0
  }
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: event => {
          startX.current = event.nativeEvent.locationX
          latest.current.onScrub(true)
          setDragAt(at(startX.current))
        },
        onPanResponderMove: (_, { dx }) => setDragAt(at(startX.current + dx)),
        onPanResponderRelease: (_, { dx }) => {
          latest.current.onSeek(at(startX.current + dx))
          latest.current.onScrub(false)
          setDragAt(null)
        },
        onPanResponderTerminate: () => {
          latest.current.onScrub(false)
          setDragAt(null)
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )
  const shown = dragAt ?? Math.min(time, duration)
  const part = duration > 0 ? shown / duration : 0
  return (
    <Box className="flex-row items-center gap-[6px] px-[4px]">
      <Text style={{ color: 'white', fontSize: 11, fontVariant: ['tabular-nums'] }}>
        {classClock(shown)}
      </Text>
      <View
        {...responder.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Class position"
        accessibilityValue={{ text: `${classClock(shown)} of ${classClock(duration)}` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={event =>
          onSeek(
            Math.min(
              Math.max(shown + (event.nativeEvent.actionName === 'increment' ? 15 : -15), 0),
              duration
            )
          )
        }
        onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
        style={{ flex: 1, height: 24, justifyContent: 'center' }}
      >
        <View
          pointerEvents="none"
          style={{
            height: dragAt === null ? 3 : 5,
            borderRadius: 3,
            backgroundColor: 'rgba(255,255,255,0.35)',
          }}
        >
          <View
            style={{
              width: `${part * 100}%`,
              height: '100%',
              borderRadius: 3,
              backgroundColor: '#ff0033',
            }}
          />
        </View>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: Math.max(0, part * width - (dragAt === null ? 6 : 8)),
            width: dragAt === null ? 12 : 16,
            height: dragAt === null ? 12 : 16,
            borderRadius: 8,
            backgroundColor: '#ff0033',
          }}
        />
      </View>
      <Text style={{ color: 'white', fontSize: 11, fontVariant: ['tabular-nums'] }}>
        -{classClock(Math.max(0, duration - shown))}
      </Text>
    </Box>
  )
}

/**
 * The class video in a floating window over the app, like the iPhone's picture in picture: it
 * keeps playing while the reader opens the chapters or moves anywhere else. Drag it from anywhere
 * on it to anywhere on the screen; a tap shows play, pause and skip, which hide again; let go and it settles against the nearest side. Push it past a
 * side and it tucks away there, leaving a tab with an arrow that brings it back while the class
 * keeps playing. ✕ closes it; the arrow in the other corner goes back to the page the class
 * started from. Until the class has played once, the middle of the window is left to YouTube's own
 * button, since the phone may only start a video from a tap on it; the play button shows what
 * YouTube reports, never a guess. A double tap on either side skips 10 seconds, and a bar shows
 * the time played and the time left. The frame stays mounted throughout, so playback never restarts, and the playing
 * time is kept so the class page picks up at the same moment.
 */
const DockedClassPlayer = () => {
  const [docked, setDocked] = useAtom(dockedClassAtom)
  const [expanded, setExpanded] = useState(false)
  const [tucked, setTucked] = useState<Side | null>(null)
  const [dragging, setDragging] = useState(false)
  // As on the iPhone's picture in picture: a tap shows the controls, which hide again on their own.
  const [controls, setControls] = useState(true)
  // Only what YouTube reports: a video the phone did not let start must not show pause.
  const [playing, setPlaying] = useState(false)
  // Whether the class has played once in this window (YouTube's state 1).
  const [started, setStarted] = useState(false)
  const [duration, setDuration] = useState(0)
  const [time, setTime] = useState(0)
  const [scrubbing, setScrubbing] = useState(false)
  const [skipped, setSkipped] = useState<{ side: 'back' | 'forward'; key: number } | null>(null)
  const askedToPlay = useRef(false)
  const lastTap = useRef<{ at: number; side: 'back' | 'forward' | null }>({ at: 0, side: null })
  const frame = useRef<ClassVideoFrameHandle>(null)
  const hideControls = useRef<ReturnType<typeof setTimeout>>(undefined)
  const hideSkipped = useRef<ReturnType<typeof setTimeout>>(undefined)
  const holdControls = useRef(false)
  holdControls.current = !playing || scrubbing
  const showControls = () => {
    setControls(true)
    clearTimeout(hideControls.current)
    // They stay up while the class is paused or the bar is held, as in the iPhone's player.
    hideControls.current = setTimeout(() => {
      if (!holdControls.current) setControls(false)
    }, 3500)
  }
  const toggleControls = () => {
    if (controls) {
      clearTimeout(hideControls.current)
      setControls(false)
    } else showControls()
  }
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { width, height } = useWindowDimensions()

  const cardWidth = expanded ? Math.min(width - MARGIN * 2, 520) : MINI_WIDTH
  const cardHeight = (cardWidth * 9) / 16

  const bounds = useRef({ minX: 0, maxX: 0, minY: 0, maxY: 0 })
  bounds.current = {
    minX: MARGIN,
    maxX: Math.max(MARGIN, width - cardWidth - MARGIN),
    minY: insets.top + MARGIN,
    // Clear of the tab bar at the bottom.
    maxY: Math.max(insets.top + MARGIN, height - cardHeight - insets.bottom - 72),
  }
  const position = useRef({ x: bounds.current.maxX, y: bounds.current.maxY })
  const pan = useRef(new Animated.ValueXY(position.current)).current

  const moveTo = (target: { x: number; y: number }, animated = true) => {
    position.current = target
    if (animated)
      Animated.spring(pan, { toValue: target, useNativeDriver: false, bounciness: 4 }).start()
    else pan.setValue(target)
  }
  const clampY = (y: number) => Math.min(Math.max(y, bounds.current.minY), bounds.current.maxY)

  // Against the nearest side, or tucked past it when more than half the window went over.
  const settle = (x: number, y: number, animated = true) => {
    const { minX, maxX } = bounds.current
    if (x + cardWidth / 2 > width) {
      setTucked('right')
      return moveTo({ x: width - TAB_WIDTH, y: clampY(y) }, animated)
    }
    if (x + cardWidth / 2 < 0) {
      setTucked('left')
      return moveTo({ x: TAB_WIDTH - cardWidth, y: clampY(y) }, animated)
    }
    setTucked(null)
    moveTo({ x: x + cardWidth / 2 < width / 2 ? minX : maxX, y: clampY(y) }, animated)
  }
  const untuck = () => {
    const side = tucked
    setTucked(null)
    moveTo({
      x: side === 'left' ? bounds.current.minX : bounds.current.maxX,
      y: position.current.y,
    })
  }

  const isOpen = !!docked
  useEffect(() => {
    if (isOpen) {
      setPlaying(false)
      setStarted(false)
      setDuration(0)
      setTime(docked?.start ?? 0)
      askedToPlay.current = false
      showControls()
    }
    return () => {
      clearTimeout(hideControls.current)
      clearTimeout(hideSkipped.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, docked?.videoId])
  useEffect(() => {
    if (isOpen) settle(bounds.current.maxX, bounds.current.maxY, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])
  useEffect(() => {
    if (!tucked) settle(position.current.x, position.current.y)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, width, height])

  // A tap shows or hides the controls; a second tap on the same side soon after skips instead.
  const tap = (x: number) => {
    const part = (x - position.current.x) / cardWidth
    const side = part < 0.4 ? 'back' : part > 0.6 ? 'forward' : null
    const now = Date.now()
    const previous = lastTap.current
    if (started && side && previous.side === side && now - previous.at < DOUBLE_TAP_MS) {
      lastTap.current = { at: 0, side: null }
      // Undo the first tap's show or hide.
      toggleControls()
      skipRef.current(side === 'back' ? -DOUBLE_TAP_SKIP : DOUBLE_TAP_SKIP, false)
      setSkipped({ side, key: now })
      clearTimeout(hideSkipped.current)
      hideSkipped.current = setTimeout(() => setSkipped(null), 700)
      return
    }
    lastTap.current = { at: now, side }
    toggleControls()
  }
  const toggleControlsRef = useRef(tap)
  toggleControlsRef.current = tap
  const skipRef = useRef<(seconds: number, show?: boolean) => void>(() => {})
  const responder = useMemo(
    () =>
      PanResponder.create({
        // The strip itself takes the press (its buttons take theirs first), so a drag from
        // anywhere on it moves the window.
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, { dx, dy }) => Math.abs(dx) > 4 || Math.abs(dy) > 4,
        // A sideways drag would otherwise be taken over by the reader's page swipe.
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => setDragging(true),
        onPanResponderMove: (_, { dx, dy }) =>
          pan.setValue({ x: position.current.x + dx, y: position.current.y + dy }),
        onPanResponderRelease: (_, { dx, dy, x0 }) => {
          setDragging(false)
          // A tap rather than a drag shows or hides the controls, or skips on a double tap.
          if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
            pan.setValue(position.current)
            toggleControlsRef.current(x0)
            return
          }
          settle(position.current.x + dx, position.current.y + dy)
        },
        onPanResponderTerminate: (_, { dx, dy }) => {
          setDragging(false)
          settle(position.current.x + dx, position.current.y + dy)
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cardWidth, width]
  )

  if (!docked) return null

  const close = () => {
    setExpanded(false)
    setTucked(null)
    setDocked(null)
  }
  // The icon follows YouTube's reported state; the press only asks.
  const togglePlay = () => {
    frame.current?.command({ func: playing ? 'pauseVideo' : 'playVideo' })
    showControls()
  }
  const seek = (seconds: number) => {
    const to = Math.max(0, duration > 0 ? Math.min(seconds, duration - 1) : seconds)
    frame.current?.command({ func: 'seekTo', args: [to, true] })
    rememberClassPosition(docked.videoId, to)
    setTime(to)
  }
  const skip = (seconds: number, show = true) => {
    seek((classPositionOf(docked.videoId) ?? time) + seconds)
    if (show) showControls()
  }
  skipRef.current = skip
  const goBack = () => {
    if (docked.returnTo) router.navigate(docked.returnTo as never)
  }

  return (
    <FloatingLayer>
      <Animated.View
        style={{
          // On the website, fixed to the window and over every sheet and dialog the site opens.
          position: Platform.OS === 'web' ? ('fixed' as 'absolute') : 'absolute',
          zIndex: 100000,
          left: 0,
          top: 0,
          width: cardWidth,
          height: cardHeight,
          borderRadius: 14,
          backgroundColor: '#000',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.35,
          shadowRadius: 20,
          elevation: 10,
          transform: pan.getTranslateTransform(),
        }}
      >
        <Box style={{ flex: 1, borderRadius: 14, overflow: 'hidden' }}>
          <ClassVideoFrame
            ref={frame}
            key={docked.videoId}
            uri={getPassageMediaEmbedUrl(docked.videoId, docked.start)}
            onTime={seconds => {
              rememberClassPosition(docked.videoId, seconds)
              if (!scrubbing) setTime(seconds)
            }}
            onDuration={setDuration}
            onState={state => {
              if (state === 1) {
                setPlaying(true)
                setStarted(true)
                showControls()
              }
              if (state === 2 || state === 0) setPlaying(false)
              if (classNotStarted(state)) {
                setPlaying(false)
                // The phone may not have let it start on its own: ask once, and if that does
                // not take, YouTube's own button in the middle of the window is left free.
                if (!askedToPlay.current) {
                  askedToPlay.current = true
                  frame.current?.command({ func: 'playVideo' })
                }
              }
            }}
          />
          {/* The whole window moves the video: the video page underneath never takes the touch. A
              tap shows the controls instead, as on the iPhone's picture in picture. */}
          {!tucked && !started && (
            // YouTube's own play button stays free in the middle; the strip on top still moves the
            // window and holds close, bigger and back.
            <Box
              {...responder.panHandlers}
              accessibilityHint="Drag to move the video"
              className="absolute left-0 right-0 top-0 flex-row items-center justify-between p-[6px]"
              style={{ cursor: dragging ? 'grabbing' : 'grab', userSelect: 'none' } as object}
            >
              <RoundButton icon="x" label="Close the video" onPress={close} />
              <Box className="flex-row gap-[6px]">
                <RoundButton
                  icon={expanded ? 'minimize-2' : 'maximize-2'}
                  label={expanded ? 'Make the video smaller' : 'Make the video bigger'}
                  onPress={() => setExpanded(value => !value)}
                />
                {docked.returnTo && (
                  <RoundButton
                    icon="corner-up-left"
                    label="Go back to the page the class started from"
                    onPress={goBack}
                  />
                )}
              </Box>
            </Box>
          )}
          {!tucked && started && (
            <Box
              {...responder.panHandlers}
              accessibilityHint="Drag to move the video; tap to show its controls"
              className="absolute inset-0"
              // No text selection: on the web a selection change ends the drag.
              style={{ cursor: dragging ? 'grabbing' : 'grab', userSelect: 'none' } as object}
            >
              {controls && !dragging && (
                <Box
                  className="absolute inset-0 justify-between p-[6px]"
                  style={{ backgroundColor: 'rgba(0,0,0,0.28)' }}
                >
                  <Box className="flex-row items-center justify-between">
                    <RoundButton icon="x" label="Close the video" onPress={close} />
                    <Box className="flex-row gap-[6px]">
                      <RoundButton
                        icon={expanded ? 'minimize-2' : 'maximize-2'}
                        label={expanded ? 'Make the video smaller' : 'Make the video bigger'}
                        onPress={() => {
                          setExpanded(value => !value)
                          showControls()
                        }}
                      />
                      {docked.returnTo && (
                        <RoundButton
                          icon="corner-up-left"
                          label="Go back to the page the class started from"
                          onPress={goBack}
                        />
                      )}
                    </Box>
                  </Box>
                  <Box className="flex-row items-center justify-center gap-[18px]">
                    <RoundButton
                      icon="rotate-ccw"
                      label="Back 15 seconds"
                      size={34}
                      onPress={() => skip(-15)}
                    />
                    <RoundButton
                      icon={playing ? 'pause' : 'play'}
                      label={playing ? 'Pause' : 'Play'}
                      size={46}
                      onPress={togglePlay}
                    />
                    <RoundButton
                      icon="rotate-cw"
                      label="Forward 15 seconds"
                      size={34}
                      onPress={() => skip(15)}
                    />
                  </Box>
                  {duration > 0 ? (
                    <Scrubber
                      time={time}
                      duration={duration}
                      onScrub={active => {
                        setScrubbing(active)
                        showControls()
                      }}
                      onSeek={seconds => {
                        seek(seconds)
                        showControls()
                      }}
                    />
                  ) : (
                    <Box style={{ height: 24 }} />
                  )}
                </Box>
              )}
              {skipped && (
                <Box
                  key={skipped.key}
                  pointerEvents="none"
                  className="absolute top-0 bottom-0 items-center justify-center"
                  style={{ width: '40%', [skipped.side === 'back' ? 'left' : 'right']: 0 }}
                >
                  <Box
                    className="flex-row items-center gap-[4px] rounded-full px-[10px] py-[4px]"
                    style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
                  >
                    <FeatherIcon
                      name={skipped.side === 'back' ? 'rotate-ccw' : 'rotate-cw'}
                      size={14}
                      color="white"
                    />
                    <Text style={{ color: 'white', fontSize: 12 }}>{DOUBLE_TAP_SKIP} seconds</Text>
                  </Box>
                </Box>
              )}
            </Box>
          )}
          {tucked && (
            <TouchableBox
              accessibilityRole="button"
              accessibilityLabel="Bring the video back"
              onPress={untuck}
              className="absolute top-0 bottom-0 items-center justify-center"
              style={{
                width: TAB_WIDTH,
                [tucked === 'right' ? 'left' : 'right']: 0,
              }}
            >
              <PipGlass radius={0} />
              <FeatherIcon
                name={tucked === 'right' ? 'chevron-left' : 'chevron-right'}
                size={22}
                color="white"
              />
            </TouchableBox>
          )}
        </Box>
      </Animated.View>
    </FloatingLayer>
  )
}

export default DockedClassPlayer
