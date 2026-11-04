import { clampPanelWidth, resolveWorkspaceLayout } from '../workspaceLayoutPolicy'

const layout = (width: number, panelOpen: boolean, wasDocked = true, sidebarHidden = false) =>
  resolveWorkspaceLayout({ width, panelOpen, wasDocked, sidebarHidden, sidebarWidth: 260 })

it('keeps navigation docked without a panel at widths previously forced into overlay', () => {
  expect(layout(1100, false)).toMatchObject({ sidebarDocked: true, mainWidth: 840 })
  expect(layout(1100, true)).toMatchObject({ sidebarDocked: false })
})

it('preserves 640 pixels for the main content when docking', () => {
  expect(layout(900, false)).toMatchObject({ sidebarDocked: true, mainWidth: 640 })
  expect(layout(899, false).sidebarDocked).toBe(false)
  expect(layout(1400, true)).toMatchObject({ sidebarDocked: true, mainWidth: 640, panelWidth: 500 })
  expect(layout(1399, true).sidebarDocked).toBe(false)
})

it('does not oscillate while resizing around the minimum width', () => {
  let docked = true
  for (const width of [1399, 1401, 1398, 1447]) {
    docked = layout(width, true, docked).sidebarDocked
    expect(docked).toBe(false)
  }
  expect(layout(1448, true, docked).sidebarDocked).toBe(true)
})

it('reclaims space after closing the panel and respects manually hidden navigation', () => {
  expect(layout(1100, false, false).sidebarDocked).toBe(true)
  expect(layout(1440, true, true, true)).toMatchObject({ sidebarDocked: true, mainWidth: 940 })
  expect(layout(1440, true, true, false)).toMatchObject({ mainWidth: 680 })
  expect(layout(1390, true, false, true).sidebarDocked).toBe(false)
})

it('keeps a dragged panel width within the window', () => {
  expect(clampPanelWidth(1200)).toBe(500)
  expect(clampPanelWidth(1200, null)).toBe(500)
  expect(clampPanelWidth(1200, 700)).toBe(700)
  // The page beside it keeps 360 pixels; the panel keeps 360 too.
  expect(clampPanelWidth(1200, 2000)).toBe(840)
  expect(clampPanelWidth(1200, 100)).toBe(360)
  // On a narrow window the panel never gets narrower than its default.
  expect(clampPanelWidth(700, 100)).toBe(315)
  expect(clampPanelWidth(700, 2000)).toBe(340)
})

it('applies the dragged width without changing when navigation docks', () => {
  expect(layout(1400, true)).toMatchObject({ sidebarDocked: true, panelWidth: 500 })
  const wide = resolveWorkspaceLayout({
    width: 1400,
    panelOpen: true,
    wasDocked: true,
    sidebarHidden: false,
    sidebarWidth: 260,
    preferredPanelWidth: 700,
  })
  expect(wide).toMatchObject({ sidebarDocked: true, panelWidth: 700, mainWidth: 440 })
})
