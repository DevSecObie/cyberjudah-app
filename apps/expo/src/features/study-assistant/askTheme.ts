import themes from '~themes'

/** Ask's own look: a midnight base, hairline edges and a warm gold accent, on top of the black
 * theme's class names so Bible Strong's components keep working inside it. */
export const ASK_THEME = {
  ...themes.black,
  colors: {
    ...themes.black.colors,
    default: '#ECEEF3',
    reverse: '#0B0F19',
    lightGrey: '#131A2A',
    border: 'rgba(255,255,255,0.06)',
    grey: 'rgba(236,238,243,0.62)',
    darkGrey: 'rgba(236,238,243,0.42)',
    primary: '#F59E0B',
    lightPrimary: 'rgba(245,158,11,0.14)',
    opacity5: 'rgba(255,255,255,0.04)',
  },
}
