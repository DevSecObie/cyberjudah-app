import { Feather, Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons'

// The browser must load the same bundled faces as the native app before showing its UI.
export const appFonts = {
  ...Feather.font,
  ...Ionicons.font,
  ...MaterialIcons.font,
  ...MaterialCommunityIcons.font,
  'Literata Book': require('~assets/fonts/LiterataBook-Regular.otf'),
  'eina-03-bold': require('~assets/fonts/Inter-Bold.ttf'),
  FiraCode: require('~assets/fonts/FiraCode-Regular.otf'),
}
