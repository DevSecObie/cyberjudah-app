import { Image } from 'expo-image'
import React, { useEffect } from 'react'
import { Appearance, StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

/** The launch image is 952 px square, shown 300 pt wide: one image pixel in points. */
const SIZE = 300
const PX = SIZE / 952
const BRACKET = 114 * PX
const BRACKETS = {
  tl: { left: 138 * PX, top: 138 * PX, dx: 1, dy: 1 },
  tr: { left: 700 * PX, top: 138 * PX, dx: -1, dy: 1 },
  bl: { left: 138 * PX, top: 700 * PX, dx: 1, dy: -1 },
  br: { left: 700 * PX, top: 700 * PX, dx: -1, dy: -1 },
} as const
const EYE = { x: 409 * PX, y: 408 * PX }

const IMAGES = {
  dark: {
    background: '#05070f',
    base: require('~assets/images/splash-anim/base-dark.png'),
    tl: require('~assets/images/splash-anim/bracket-tl-dark.png'),
    tr: require('~assets/images/splash-anim/bracket-tr-dark.png'),
    bl: require('~assets/images/splash-anim/bracket-bl-dark.png'),
    br: require('~assets/images/splash-anim/bracket-br-dark.png'),
  },
  light: {
    background: '#ffffff',
    base: require('~assets/images/splash-anim/base.png'),
    tl: require('~assets/images/splash-anim/bracket-tl.png'),
    tr: require('~assets/images/splash-anim/bracket-tr.png'),
    bl: require('~assets/images/splash-anim/bracket-bl.png'),
    br: require('~assets/images/splash-anim/bracket-br.png'),
  },
}

const ease = Easing.bezier(0.22, 1, 0.36, 1)

const Bracket = ({
  corner,
  source,
  lock,
}: {
  corner: keyof typeof BRACKETS
  source: number
  lock: { value: number }
}) => {
  const { left, top, dx, dy } = BRACKETS[corner]
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: dx * 16 * lock.value }, { translateY: dy * 16 * lock.value }],
  }))
  return (
    <Animated.View style={[{ position: 'absolute', left, top }, style]}>
      <Image source={source} style={{ width: BRACKET, height: BRACKET }} />
    </Animated.View>
  )
}

/**
 * Takes over from the still launch image on the same first frame, then: the brackets lock onto
 * the lion, the robot eye lights up while a scan line crosses the grid, and the lion opens into
 * the app. About a second; with Reduce Motion on it only fades.
 */
export default function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const reduceMotion = useReducedMotion()
  const scheme = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light'
  const images = IMAGES[scheme]
  const lock = useSharedValue(0)
  const eye = useSharedValue(0)
  const scan = useSharedValue(0)
  const exit = useSharedValue(0)

  useEffect(() => {
    const finish = (finished?: boolean) => {
      'worklet'
      if (finished) runOnJS(onDone)()
    }
    if (reduceMotion) {
      exit.value = withTiming(1, { duration: 250, reduceMotion: ReduceMotion.Never }, finish)
      return
    }
    lock.value = withDelay(
      120,
      withSequence(
        withTiming(1, { duration: 280, easing: ease }),
        withTiming(0.55, { duration: 180, easing: ease })
      )
    )
    scan.value = withDelay(260, withTiming(1, { duration: 620, easing: Easing.inOut(Easing.quad) }))
    eye.value = withDelay(
      380,
      withSequence(
        withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) }),
        withTiming(0.45, { duration: 260 })
      )
    )
    exit.value = withDelay(900, withTiming(1, { duration: 380, easing: ease }, finish))
  }, [eye, exit, lock, onDone, reduceMotion, scan])

  const containerStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.value }))
  const artStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + exit.value * 0.18 }],
  }))
  const eyeStyle = useAnimatedStyle(() => ({
    opacity: eye.value,
    transform: [{ scale: 0.6 + eye.value * 0.6 }],
  }))
  const scanStyle = useAnimatedStyle(() => ({
    opacity: scan.value > 0 && scan.value < 1 ? 1 : 0,
    transform: [{ translateY: scan.value * SIZE }],
  }))

  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        StyleSheet.absoluteFill,
        styles.center,
        { backgroundColor: images.background },
        containerStyle,
      ]}
    >
      <Animated.View style={[{ width: SIZE, height: SIZE }, artStyle]}>
        <Image source={images.base} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
          <Animated.View style={[styles.scan, scanStyle]} />
        </View>
        <Animated.View style={[styles.eye, eyeStyle]} />
        <Bracket corner="tl" source={images.tl} lock={lock} />
        <Bracket corner="tr" source={images.tr} lock={lock} />
        <Bracket corner="bl" source={images.bl} lock={lock} />
        <Bracket corner="br" source={images.br} lock={lock} />
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  scan: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -1,
    height: 2,
    backgroundColor: '#29d3f5',
    shadowColor: '#29d3f5',
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  eye: {
    position: 'absolute',
    left: EYE.x - 9,
    top: EYE.y - 9,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#5cc8ff',
    shadowColor: '#2f8bff',
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
})
