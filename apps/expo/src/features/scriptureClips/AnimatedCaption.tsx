import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { ZoomIn, useReducedMotion } from 'react-native-reanimated'
import { captionAt, type ClipCaption } from './scriptureClips'

const SAID = '#FFFFFF'
const SAYING = '#FFD75E'

type Props = {
  captions?: ClipCaption[]
  /** Seconds into the clip right now. */
  getElapsed: () => number
}

/**
 * The class's own words under the video, Shorts style: each word pops in as it is said, and the
 * word being said is gold.
 */
const AnimatedCaption = ({ captions, getElapsed }: Props) => {
  const reduceMotion = useReducedMotion()
  const [elapsed, setElapsed] = useState(() => getElapsed())

  useEffect(() => {
    const timer = setInterval(() => setElapsed(getElapsed()), 80)
    return () => clearInterval(timer)
  }, [getElapsed])

  const frame = captionAt(captions, elapsed)
  if (!frame) return <View style={styles.line} />

  return (
    <View style={styles.line} accessible accessibilityLabel={frame.words.join(' ')}>
      {frame.words.slice(0, frame.shown).map((word, index) => (
        <Animated.View
          key={`${frame.line}-${index}`}
          entering={reduceMotion ? undefined : ZoomIn.duration(140)}
        >
          <Text
            style={[styles.word, { color: index === frame.shown - 1 ? SAYING : SAID }]}
            importantForAccessibility="no"
          >
            {word}
          </Text>
        </Animated.View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  line: {
    minHeight: 64,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 6,
    paddingHorizontal: 20,
  },
  word: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
})

export default AnimatedCaption
