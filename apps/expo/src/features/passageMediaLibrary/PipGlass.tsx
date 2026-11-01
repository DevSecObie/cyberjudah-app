import { Platform, StyleSheet } from 'react-native'
import Box from '~common/ui/Box'

export type PipGlassProps = { radius: number }

/**
 * The glass behind the floating player's buttons. The web gets a frosted blur, like Apple's
 * glass over the video; Android keeps a plain dark tint.
 */
export default function PipGlass({ radius }: PipGlassProps) {
  return (
    <Box
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          borderRadius: radius,
          backgroundColor: 'rgba(30,30,30,0.38)',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: 'rgba(255,255,255,0.35)',
        },
        Platform.OS === 'web'
          ? ({
              backdropFilter: 'blur(18px) saturate(180%)',
              WebkitBackdropFilter: 'blur(18px) saturate(180%)',
            } as object)
          : null,
      ]}
    />
  )
}
