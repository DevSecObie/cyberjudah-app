import React, { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppState } from 'react-native'
import { useFocusEffect } from 'expo-router'
import ListSection, { ListRow } from '~common/ui/ListSection'
import { FeatherIcon, IonIcon } from '~common/ui/Icon'
import useLogin from '~helpers/useLogin'
import { connectTelegramAccount } from '~helpers/cyberJudahAccount'
import {
  connectedProviders,
  loadAccountConnections,
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
  const request = useRef<AbortController | null>(null)
  const refresh = useCallback(() => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setState({
      uid: user.id,
      providers: connectedProviders(user.id),
      telegram: { status: 'checking' },
    })
    void loadAccountConnections(user.id, controller.signal).then(result => {
      if (!controller.signal.aborted && result) setState(result)
    })
  }, [user.id])

  useFocusEffect(
    useCallback(() => {
      refresh()
      const unsubscribe = subscribeAccountConnections(refresh)
      const appState = AppState.addEventListener('change', value => {
        if (value === 'active') refresh()
      })
      return () => {
        request.current?.abort()
        unsubscribe()
        appState.remove()
      }
    }, [refresh])
  )

  const visible = state?.uid === user.id ? state : null
  const providers = visible?.providers ?? connectedProviders(user.id)
  const telegram = visible?.telegram ?? { status: 'checking' }
  const linked = telegram.status === 'connected'
  const description = linked
    ? telegram.label || t('profile.connectedAccounts.connected')
    : telegram.status === 'checking'
      ? t('profile.connectedAccounts.checking')
      : telegram.status === 'not-connected'
        ? t('profile.connectedAccounts.notConnected')
        : t('profile.connectedAccounts.unavailable')

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
      <ListRow
        label={
          telegram.status === 'not-connected'
            ? t('profile.connectedAccounts.connectTelegram')
            : 'Telegram'
        }
        description={description}
        icon={<FeatherIcon name="link" size={18} color="grey" />}
        trailing={linked ? <FeatherIcon name="check" size={18} color="primary" /> : undefined}
        hasChevron={telegram.status === 'not-connected'}
        onPress={
          telegram.status === 'not-connected'
            ? () => void connectTelegramAccount()
            : telegram.status === 'unavailable'
              ? refresh
              : undefined
        }
        accessibilityLabel={`Telegram, ${linked ? t('profile.connectedAccounts.connected') : description}${linked && telegram.label ? `, ${telegram.label}` : ''}`}
      />
    </ListSection>
  )
}
