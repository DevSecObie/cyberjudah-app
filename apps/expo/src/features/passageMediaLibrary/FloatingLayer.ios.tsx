import type { ReactNode } from 'react'
import { FullWindowOverlay } from 'react-native-screens'

/**
 * The iPhone: sheets, modals and pushed windows each open in a layer of their own above the app,
 * so the floating video lives in a layer over all of them. Touches outside the video pass through.
 */
const FloatingLayer = ({ children }: { children: ReactNode }) => (
  <FullWindowOverlay>{children}</FullWindowOverlay>
)

export default FloatingLayer
