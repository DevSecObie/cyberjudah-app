import type { ReactNode } from 'react'

/** Android and the website: the window is drawn last at the root, over the app's screens. */
const FloatingLayer = ({ children }: { children: ReactNode }) => <>{children}</>

export default FloatingLayer
