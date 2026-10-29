import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppState } from 'react-native'
import { useFocusEffect } from 'expo-router'
import ListSection, { ListRow } from '~common/ui/ListSection'
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
    <ListSection title={t('profile.connectedAccounts.title')}>
      {providers.map(provider => (
        <ListRow
          key={provider.id}
          label={
            provider.id === 'password'
              ? t('profile.connectedAccounts.email')
              : providerLabels[provider.id].label
          }
          description={provider.email || t('profile.connectedAccounts.connected')}
          icon={<IonIcon name={providerLabels[provider.id].icon} size={18} color="grey" />}
          trailing={<FeatherIcon name="check" size={18} color="primary" />}
          hasChevron={false}
          accessibilityLabel={`${provider.id === 'password' ? t('profile.connectedAccounts.email') : providerLabels[provider.id].label}, ${t('profile.connectedAccounts.connected')}${provider.email ? `, ${provider.email}` : ''}`}
        />
      ))}
    </ListSection>
  )
}
