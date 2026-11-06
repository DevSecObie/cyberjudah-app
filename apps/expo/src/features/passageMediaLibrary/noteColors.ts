import type { Theme } from '~themes/ThemeProvider'

/** Whether a theme colour is a light one, by its brightness: rgb(…) or #rrggbb. */
const isLight = (color: string) => {
  const rgb = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color)
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(color)
  const [r, g, b] = rgb
    ? rgb.slice(1, 4).map(Number)
    : hex
      ? hex.slice(1, 4).map(part => parseInt(part, 16))
      : [255, 255, 255]
  return 0.299 * r + 0.587 * g + 0.114 * b > 150
}

export const noteColors = (theme: Theme) => ({
  text: theme.colors.default,
  muted: theme.colors.grey,
  link: theme.colors.primary,
  surface: theme.colors.lightGrey,
  border: theme.colors.border,
  verse: isLight(theme.colors.reverse) ? '#8A5A12' : '#E0A64A',
})
