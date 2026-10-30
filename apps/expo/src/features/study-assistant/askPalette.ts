import { useTheme } from '~themes/ThemeProvider'

/** Ask's colour roles, read from the theme Ask runs in (askTheme.ts) so every Ask part agrees. */
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
  edge: string
  edgeStrong: string
}

export function useAskPalette(): AskPalette {
  const { colors } = useTheme()
  return {
    canvas: colors.reverse,
    surface1: colors.lightGrey,
    surface2: '#1A2236',
    text1: colors.default,
    text3: colors.grey,
    text4: colors.darkGrey,
    accent: colors.primary,
    onAccent: '#0B0F19',
    accentSoft: colors.lightPrimary,
    edge: colors.border,
    edgeStrong: 'rgba(255,255,255,0.12)',
  }
}
