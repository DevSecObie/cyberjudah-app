import { StyleSheet } from 'react-native'
import Box from '~common/ui/Box'

export type GlassBackdropProps = { radius?: number }

/** The existing Bible Strong surface on platforms without Apple's glass material. */
export default function GlassBackdrop({ radius = 24 }: GlassBackdropProps) {
  return (
    <Box
      pointerEvents="none"
      className="bg-light-grey"
      style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
    />
  )
}
