import { useSetAtom } from 'jotai'
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '~themes/ThemeProvider'
import { workspacePanelResizingAtom, workspacePanelWidthAtom } from './useWorkspaceRoutePanel'

const HANDLE_WIDTH = 8
const KEY_STEP = 32

/**
 * The side panel's left edge, dragged to make the panel wider or narrower (as in a chat app's
 * split view). Double-click puts back the default width; the arrow keys move it when focused.
 * The width is kept for the next visit; useWorkspaceRoutePanel keeps it within the window.
 */
export default function WorkspacePanelResizer({ panelWidth }: { panelWidth: number }) {
  const { t } = useTranslation()
  const theme = useTheme()
  const setWidth = useSetAtom(workspacePanelWidthAtom)
  const setResizing = useSetAtom(workspacePanelResizingAtom)
  const drag = useRef<{ x: number; width: number } | null>(null)
  const [active, setActive] = useState(false)
  const [hover, setHover] = useState(false)

  const end = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    drag.current = null
    setActive(false)
    setResizing(false)
    document.body.style.removeProperty('cursor')
    document.body.style.removeProperty('user-select')
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') setWidth(panelWidth + KEY_STEP)
    else if (event.key === 'ArrowRight') setWidth(panelWidth - KEY_STEP)
    else if (event.key === 'Home' || event.key === 'Enter') setWidth(null)
    else return
    event.preventDefault()
  }

  const label = t('Redimensionner le panneau')
  return (
    <div
      data-testid="workspace-panel-resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={Math.round(panelWidth)}
      title={label}
      tabIndex={0}
      onPointerDown={event => {
        if (event.button !== 0) return
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        drag.current = { x: event.clientX, width: panelWidth }
        setActive(true)
        setResizing(true)
        // Keep the resize cursor and stop text selection while the pointer crosses the page.
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'
      }}
      onPointerMove={event => {
        if (!drag.current) return
        setWidth(drag.current.width + (drag.current.x - event.clientX))
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onDoubleClick={() => setWidth(null)}
      onKeyDown={onKeyDown}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      // The line doubles as the keyboard focus ring.
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      style={{
        // Inside the panel over its left border: the panel clips anything outside its edge.
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        width: HANDLE_WIDTH,
        cursor: 'col-resize',
        touchAction: 'none',
        zIndex: 99,
        display: 'flex',
        justifyContent: 'flex-start',
        outline: 'none',
      }}
    >
      <div
        style={{
          width: 2,
          height: '100%',
          backgroundColor: theme.colors.primary,
          opacity: active ? 1 : hover ? 0.6 : 0,
          transition: 'opacity 120ms',
        }}
      />
    </div>
  )
}
