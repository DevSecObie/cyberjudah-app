import { goBackOrHome } from '~navigation/goBackOrHome'
import { backUnderPanel } from '~navigation/backUnderPanel'
import { navigateWithPageTransition } from '~navigation/pageTransition'
import { useNavigation, useRouter } from 'expo-router'
import { NavigationRouteContext } from 'expo-router/react-navigation'
import React, { FC, PropsWithChildren, useContext } from 'react'
import { useTranslation } from 'react-i18next'
import { Platform, StyleProp, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native'

type BackProps = {
  padding?: boolean
  style?: StyleProp<ViewStyle>
  onCustomPress?: () => void
  onGoBack?: () => void
}

const Back: FC<PropsWithChildren<BackProps>> = ({
  padding,
  style,
  onCustomPress,
  onGoBack,
  ...props
}: BackProps) => {
  const { t } = useTranslation()
  const router = useRouter()
  const navigation = useNavigation()
  // Outside a screen there is no route; read it without throwing.
  const route = useContext(NavigationRouteContext)

  const handlePress = () => {
    let currentNavigation: typeof navigation | undefined = navigation
    let previousPath = ''
    while (currentNavigation) {
      const state = currentNavigation.getState()
      const previous = state?.routes[(state.index ?? 0) - 1]
      if (previous) {
        previousPath = '/' + previous.name
        break
      }
      currentNavigation = currentNavigation.getParent()
    }
    // A side panel open beside this page stays open: only the page goes back.
    const underPanel =
      Platform.OS === 'web' ? backUnderPanel(navigation as never, route?.key) : undefined
    if (underPanel) {
      navigateWithPageTransition(previousPath, underPanel, 'back')
      onGoBack?.()
      return
    }
    goBackOrHome(router, previousPath)
    onGoBack?.()
  }

  return (
    <TouchableOpacity
      {...props}
      onPress={onCustomPress || handlePress}
      accessibilityRole="button"
      accessibilityLabel={t('accessibility.back')}
      style={{
        ...StyleSheet.flatten(style),
        ...(padding && {
          width: 54,
          height: 54,
          alignItems: 'center',
          justifyContent: 'center',
        }),
      }}
    />
  )
}

export default Back
