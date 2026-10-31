import { useRouter } from 'expo-router'
import { useAtom } from 'jotai'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Animated, PanResponder, Platform, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { getPassageMediaEmbedUrl } from '~features/bible/passageMedia'
import ClassVideoFrame from './ClassVideoFrame'
import FloatingLayer from './FloatingLayer'
import { rememberClassPosition } from './classVideoPosition'
import PipGlass from './PipGlass'
import { dockedClassAtom } from './dockedClassPlayerStore'

const MARGIN = 12
const MINI_WIDTH = 240
// The strip along the top of the window that carries its buttons and moves the window.
const BAR_HEIGHT = 36
// How much of a window pushed off the side stays on screen.
const TAB_WIDTH = 28

type Side = 'left' | 'right'

const RoundButton = ({
  icon,
  label,
  onPress,
}: {
  icon: 'x' | 'corner-up-left' | 'maximize-2' | 'minimize-2'
  label: string
  onPress: () => void
}) => (
  <TouchableBox
    accessibilityRole="button"
    accessibilityLabel={label}
    onPress={onPress}
    className="w-[30px] h-[30px] rounded-full items-center justify-center"
  >
    <PipGlass radius={15} />
    <FeatherIcon name={icon} size={14} color="white" />
  </TouchableBox>
)

/**
 * The class video in a floating window over the app, like the iPhone's picture in picture: it
 * keeps playing while the reader opens the chapters or moves anywhere else. Drag it by its top
 * strip anywhere on the screen; let go and it settles against the nearest side. Push it past a
 * side and it tucks away there, leaving a tab with an arrow that brings it back while the class
 * keeps playing. ✕ closes it; the arrow in the other corner goes back to the page the class
 * started from. The frame stays mounted throughout, so playback never restarts, and the playing
 * time is kept so the class page picks up at the same moment.
 */
const DockedClassPlayer = () => {
  const [docked, setDocked] = useAtom(dockedClassAtom)
  const [expanded, setExpanded] = useState(false)
  const [tucked, setTucked] = useState<Side | null>(null)
  const [dragging, setDragging] = useState(false)
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
    if (isOpen) settle(bounds.current.maxX, bounds.current.maxY, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])
  useEffect(() => {
    if (!tucked) settle(position.current.x, position.current.y)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, width, height])

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
        onPanResponderRelease: (_, { dx, dy }) => {
          setDragging(false)
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
            key={docked.videoId}
            uri={getPassageMediaEmbedUrl(docked.videoId, docked.start)}
            onTime={seconds => rememberClassPosition(docked.videoId, seconds)}
          />
          {/* While the window moves, the video page must not catch the pointer. */}
          {dragging && <Box className="absolute inset-0" />}
          {!tucked && (
            <Box
              {...responder.panHandlers}
              accessibilityHint="Drag to move the video"
              className="absolute left-0 right-0 top-0 flex-row items-center justify-between px-[6px]"
              // No text selection from the strip: on the web a selection change ends the drag.
              style={{ height: BAR_HEIGHT, cursor: 'grab', userSelect: 'none' } as object}
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
