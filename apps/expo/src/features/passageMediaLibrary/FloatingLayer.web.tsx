import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * The website: sheets and dialogs open in layers of their own at the end of the page, so the
 * floating video gets a layer of its own above every one of them. (It is never moved once made:
 * moving the video's frame would restart it.) It covers nothing but the video itself.
 */
const FloatingLayer = ({ children }: { children: ReactNode }) => {
  const [layer, setLayer] = useState<HTMLDivElement | null>(null)
  useEffect(() => {
    const element = document.createElement('div')
    element.setAttribute('data-floating-video', '')
    Object.assign(element.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483000',
      pointerEvents: 'none',
    })
    document.body.appendChild(element)
    setLayer(element)
    return () => element.remove()
  }, [])
  if (!layer) return null
  return createPortal(<div style={{ pointerEvents: 'auto' }}>{children}</div>, layer)
}

export default FloatingLayer
