import { StyleSheet } from 'react-native'
import Box from '~common/ui/Box'

export type AskGlassBackdropProps = { radius?: number }

/** The existing Bible Strong surface on platforms without Apple's glass material. */
export default function AskGlassBackdrop({ radius = 24 }: AskGlassBackdropProps) {
  return (
    <Box
      pointerEvents="none"
      className="bg-light-grey"
      style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
    />
  )
}
