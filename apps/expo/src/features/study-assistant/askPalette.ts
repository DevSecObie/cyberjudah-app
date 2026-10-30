import { useTheme } from '~themes/ThemeProvider'

/** Ask's colour roles, all read from the reader's app theme so Ask matches the other screens. */
export type AskPalette = {
  canvas: string
  surface1: string
  surface2: string
  text1: string
  text3: string
  text4: string
  accent: string
  onAccent: string
  accentSoft: string
  /** The accent at a given strength, for hairlines, rings and glows. */
  accentAt: (opacity: number) => string
  edge: string
  edgeStrong: string
}

/** A theme colour (hex, rgb() or rgba()) at the given opacity. */
export function withOpacity(color: string, opacity: number) {
  const hex = /^#([0-9a-f]{6})$/i.exec(color.trim())?.[1]
  if (hex) {
    const n = Number.parseInt(hex, 16)
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${opacity})`
  }
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(color.trim())?.[1]?.split(',').slice(0, 3)
  return rgb?.length === 3 ? `rgba(${rgb.map(x => x.trim()).join(',')},${opacity})` : color
}

export function useAskPalette(): AskPalette {
  const { colors } = useTheme()
  return {
    canvas: colors.reverse,
    surface1: colors.lightGrey,
    surface2: colors.lightGrey,
    text1: colors.default,
    text3: colors.grey,
    text4: colors.grey,
    accent: colors.primary,
    onAccent: '#ffffff',
    accentSoft: colors.lightPrimary,
    accentAt: opacity => withOpacity(colors.primary, opacity),
    edge: colors.border,
    edgeStrong: colors.border,
  }
}
