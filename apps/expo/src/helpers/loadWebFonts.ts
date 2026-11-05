import { loadAsync } from 'expo-font'
import { appFonts } from './appFonts'

// Faces the first screen measures and paints with. The icon fonts (about 1 MB together) load
// alongside the first screen instead of before it, and each icon appears as its font arrives.
const PAINT_FACES = ['Literata Book', 'eina-03-bold', 'FiraCode'] as const

export const loadWebFonts = async () => {
  const paintFonts = Object.fromEntries(
    Object.entries(appFonts).filter(([name]) => (PAINT_FACES as readonly string[]).includes(name))
  )
  const iconFonts = Object.fromEntries(
    Object.entries(appFonts).filter(([name]) => !(PAINT_FACES as readonly string[]).includes(name))
  )
  void loadAsync(iconFonts).catch(() => undefined)
  await loadAsync(paintFonts)
  // Some browser runtimes register @font-face without requesting an unused face.
  // Load reading/title faces explicitly before measuring and painting the UI.
  if (typeof document !== 'undefined' && document.fonts) {
    await Promise.all(
      ['Literata Book', 'FiraCode'].map(family => document.fonts.load(`16px "${family}"`))
    )
  }
}
