import { useTheme } from '~themes/ThemeProvider'

/** cyberjudah.io/app's Ask colour roles mapped onto the app's own (Bible Strong) theme tokens, so
 * Ask keeps the site's layout but looks like the rest of the app in every theme. */
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
    edge: colors.border,
  }
}
