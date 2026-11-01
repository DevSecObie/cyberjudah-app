import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppState } from 'react-native'
import { useFocusEffect } from 'expo-router'
import SectionCard, { SectionCardHeader } from '~common/ui/SectionCard'
import CardLinkItem from '~common/ui/CardLinkItem'
import Text from '~common/ui/Text'
import Box from '~common/ui/Box'
import { FeatherIcon, IonIcon } from '~common/ui/Icon'
import useLogin from '~helpers/useLogin'
import {
  connectedProviders,
  subscribeAccountConnections,
  type AccountConnections,
} from '~helpers/accountConnections'

const providerLabels = {
  'google.com': { label: 'Google', icon: 'logo-google' as const },
  'apple.com': { label: 'Apple', icon: 'logo-apple' as const },
  password: { label: 'Email', icon: 'mail' as const },
}

/** Existing Bible Strong list surfaces; connection state comes from the verified accounts. */
export default function ConnectedAccounts() {
  const { t } = useTranslation()
  const { user } = useLogin()
  const [state, setState] = useState<AccountConnections | null>(null)
  const refresh = useCallback(() => {
    setState({ uid: user.id, providers: connectedProviders(user.id) })
  }, [user.id])

  useFocusEffect(
    useCallback(() => {
      refresh()
      const unsubscribe = subscribeAccountConnections(refresh)
      const appState = AppState.addEventListener('change', value => {
        if (value === 'active') refresh()
      })
      return () => {
        unsubscribe()
        appState.remove()
      }
    }, [refresh])
  )

  const visible = state?.uid === user.id ? state : null
  const providers = visible?.providers ?? connectedProviders(user.id)

  return (
    <SectionCard>
      <SectionCardHeader>
        <FeatherIcon name="user-check" size={16} color="grey" />
        <Text
          className="ml-[8px] text-[12px] text-grey font-bold"
          style={{ textTransform: 'uppercase' }}
        >
          {t('profile.connectedAccounts.title')}
        </Text>
      </SectionCardHeader>
      {providers.map((provider, index) => (
        <CardLinkItem
          key={provider.id}
          isLast={index === providers.length - 1}
          accessibilityLabel={`${provider.id === 'password' ? t('profile.connectedAccounts.email') : providerLabels[provider.id].label}, ${t('profile.connectedAccounts.connected')}${provider.email ? `, ${provider.email}` : ''}`}
        >
          <IonIcon name={providerLabels[provider.id].icon} size={20} color="grey" />
          <Box className="flex-1">
            <Text className="text-[15px]">
              {provider.id === 'password'
                ? t('profile.connectedAccounts.email')
                : providerLabels[provider.id].label}
            </Text>
            <Text className="text-[12px] text-grey">
              {provider.email || t('profile.connectedAccounts.connected')}
            </Text>
          </Box>
          <FeatherIcon name="check" size={18} color="primary" />
        </CardLinkItem>
      ))}
    </SectionCard>
  )
}
