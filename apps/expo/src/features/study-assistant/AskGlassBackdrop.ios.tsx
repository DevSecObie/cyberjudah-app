import { useEffect, useState } from 'react'
import { AccessibilityInfo, Platform, StyleSheet } from 'react-native'
import { Host, RoundedRectangle } from '@expo/ui/swift-ui'
import { accessibilityHidden, foregroundStyle, glassEffect } from '@expo/ui/swift-ui/modifiers'
import Box from '~common/ui/Box'
import { useTheme } from '~themes/ThemeProvider'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import type { AskGlassBackdropProps } from './AskGlassBackdrop'

export default function AskGlassBackdrop({ radius = 24 }: AskGlassBackdropProps) {
  const { colors } = useTheme()
  const { colorScheme } = useCurrentThemeSelector()
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
        className="bg-light-grey"
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
    )
  }
  // Only the background enters SwiftUI; the React Native field retains focus, sizing and touches.
  return (
    <Host
      colorScheme={colorScheme}
      pointerEvents="none"
      ignoreSafeArea="all"
      style={StyleSheet.absoluteFill}
    >
      <RoundedRectangle
        cornerRadius={radius}
        modifiers={[
          foregroundStyle('transparent'),
          glassEffect({
            glass: { variant: 'regular', tint: colors.lightGrey },
            shape: 'roundedRectangle',
            cornerRadius: radius,
          }),
          accessibilityHidden(),
        ]}
      />
    </Host>
  )
}
