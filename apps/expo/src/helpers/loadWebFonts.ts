import { loadAsync } from 'expo-font'
import { appFonts } from './appFonts'

// Faces the first screen measures and paints with.
const PAINT_FACES = ['Literata Book', 'eina-03-bold', 'FiraCode'] as const
// Feather draws the tab bar and toolbars, so it loads alongside the first screen. The other icon
// fonts (about 2 MB together, most of it MaterialCommunityIcons) wait until that screen is up, so
// they never compete with it for the connection; each icon appears as its font arrives.
const EARLY_ICON_FACES = ['feather'] as const

const pick = (keep: (name: string) => boolean) =>
  Object.fromEntries(Object.entries(appFonts).filter(([name]) => keep(name)))
const isPaint = (name: string) => (PAINT_FACES as readonly string[]).includes(name)
const isEarlyIcon = (name: string) => (EARLY_ICON_FACES as readonly string[]).includes(name)

// A few seconds after start, at a quiet moment: by then the first screen has its files and data.
const afterFirstScreen = (task: () => void) => {
  const idle = (globalThis as { requestIdleCallback?: typeof requestIdleCallback })
    .requestIdleCallback
  setTimeout(() => (idle ? idle(task, { timeout: 3000 }) : task()), 4000)
}

export const loadWebFonts = async () => {
  const paintFonts = pick(isPaint)
  const earlyIconFonts = pick(isEarlyIcon)
  const laterIconFonts = pick(name => !isPaint(name) && !isEarlyIcon(name))
  void loadAsync(earlyIconFonts).catch(() => undefined)
  await loadAsync(paintFonts)
  if (Object.keys(laterIconFonts).length)
    afterFirstScreen(() => void loadAsync(laterIconFonts).catch(() => undefined))
  // Some browser runtimes register @font-face without requesting an unused face.
  // Load reading/title faces explicitly before measuring and painting the UI.
  if (typeof document !== 'undefined' && document.fonts) {
    await Promise.all(
      ['Literata Book', 'FiraCode'].map(family => document.fonts.load(`16px "${family}"`))
    )
  }
}
