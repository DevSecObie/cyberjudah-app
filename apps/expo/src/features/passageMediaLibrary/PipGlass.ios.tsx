import { useEffect, useState } from 'react'
import { AccessibilityInfo, Platform, StyleSheet } from 'react-native'
import { Host, RoundedRectangle } from '@expo/ui/swift-ui'
import { accessibilityHidden, foregroundStyle, glassEffect } from '@expo/ui/swift-ui/modifiers'
import Box from '~common/ui/Box'
import type { PipGlassProps } from './PipGlass'

/** Apple's Liquid Glass behind the floating player's buttons, as on the iPhone's own player. */
export default function PipGlass({ radius }: PipGlassProps) {
  // Remain opaque until the accessibility preference is known.
  const [reduceTransparency, setReduceTransparency] = useState(true)
  useEffect(() => {
    let mounted = true
    void AccessibilityInfo.isReduceTransparencyEnabled()
      .then(value => {
        if (mounted) setReduceTransparency(value)
      })
      .catch(() => {})
    const listener = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      setReduceTransparency
    )
    return () => {
      mounted = false
      listener.remove()
    }
  }, [])
  if (Number.parseInt(String(Platform.Version), 10) < 26 || reduceTransparency) {
    return (
      <Box
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: radius, backgroundColor: 'rgba(30,30,30,0.7)' },
        ]}
      />
    )
  }
  return (
    <Host
      colorScheme="dark"
      pointerEvents="none"
      ignoreSafeArea="all"
      style={StyleSheet.absoluteFill}
    >
      <RoundedRectangle
        cornerRadius={radius}
        modifiers={[
          foregroundStyle('transparent'),
          glassEffect({
            glass: { variant: 'regular', interactive: true },
            shape: 'roundedRectangle',
            cornerRadius: radius,
          }),
          accessibilityHidden(),
        ]}
      />
    </Host>
  )
}
