export const WORKSPACE_ROUTE_PANEL_WIDTH = 500
export const WORKSPACE_MIN_MAIN_WIDTH = 640
export const WORKSPACE_REDOCK_MARGIN = 48
/** The narrowest a reader may drag the panel, and the least it leaves the page beside it. */
export const WORKSPACE_PANEL_MIN_WIDTH = 360
export const WORKSPACE_MAIN_MIN_WIDTH_RESIZED = 360

/** The panel's width in `available` pixels: the reader's dragged width, kept within bounds, or the default. */
export function clampPanelWidth(available: number, preferred?: number | null) {
  const standard = Math.min(WORKSPACE_ROUTE_PANEL_WIDTH, available * 0.45)
  if (preferred == null || !Number.isFinite(preferred)) return standard
  const minimum = Math.min(WORKSPACE_PANEL_MIN_WIDTH, standard)
  const maximum = Math.max(minimum, available - WORKSPACE_MAIN_MIN_WIDTH_RESIZED)
  return Math.round(Math.min(maximum, Math.max(minimum, preferred)))
}

/** Evaluate docking with the sidebar present, even when manually hidden. This
 * avoids a feedback loop where hiding it immediately makes it eligible again. */
export function resolveWorkspaceLayout({
  width,
  sidebarWidth,
  panelOpen,
  sidebarHidden,
  wasDocked,
  preferredPanelWidth,
}: {
  width: number
  sidebarWidth: number
  panelOpen: boolean
  sidebarHidden: boolean
  wasDocked: boolean
  /** A width the reader dragged the panel to; docking still follows the default width. */
  preferredPanelWidth?: number | null
}) {
  const withSidebar = Math.max(0, width - sidebarWidth)
  const candidatePanel = panelOpen ? Math.min(WORKSPACE_ROUTE_PANEL_WIDTH, withSidebar * 0.45) : 0
  const minimum = WORKSPACE_MIN_MAIN_WIDTH + (wasDocked ? 0 : WORKSPACE_REDOCK_MARGIN)
  const sidebarDocked = withSidebar - candidatePanel >= minimum
  const availableWidth = Math.max(0, width - (sidebarDocked && !sidebarHidden ? sidebarWidth : 0))
  const panelWidth = clampPanelWidth(availableWidth, preferredPanelWidth)
  return { sidebarDocked, panelWidth, mainWidth: availableWidth - (panelOpen ? panelWidth : 0) }
}
