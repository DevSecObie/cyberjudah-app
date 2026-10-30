import { useTheme } from '~themes/ThemeProvider'

/** cyberjudah.io/app's Ask colours (telegram app/src/styles/tokens.css), dark and light, so the
 * app's Ask looks like the site's. Which one follows the app's own theme. */
const DARK = {
  dark: true,
  canvas: '#05070f',
  surface1: '#0b1020',
  surface2: '#141c36',
  text1: '#f2f6fb',
  text3: '#9fb1c8',
  text4: '#6f8199',
  accent: '#00e5ff',
  onAccent: '#00161c',
  accentSoft: 'rgba(0,229,255,0.14)',
  edge: 'rgba(255,255,255,0.07)',
  overlay: 'rgba(16,22,40,0.92)',
}
const LIGHT = {
  dark: false,
  canvas: '#f6f4ee',
  surface1: '#ffffff',
  surface2: '#ece8de',
  text1: '#14120e',
  text3: '#5c574e',
  text4: '#6b665c',
  accent: '#006a93',
  onAccent: '#ffffff',
  accentSoft: 'rgba(0,106,147,0.12)',
  edge: 'rgba(40,30,10,0.08)',
  overlay: 'rgba(255,255,255,0.94)',
}
export type AskPalette = typeof DARK

function luminance(color: string) {
  const hex = /^#([0-9a-f]{6})$/i.exec(color)?.[1]
  const rgb = hex
    ? [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16))
    : (/rgba?\(([^)]+)\)/.exec(color)?.[1].split(',').slice(0, 3).map(Number) ?? [255, 255, 255])
  return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255
}

export function useAskPalette(): AskPalette {
  const { colors } = useTheme()
  return luminance(colors.reverse) < 0.5 ? DARK : LIGHT
}
