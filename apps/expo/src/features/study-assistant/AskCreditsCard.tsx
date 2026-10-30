import { useEffect, useState } from 'react'
import { AppState, Linking, Pressable } from 'react-native'
import { useTranslation } from 'react-i18next'
import Box, { HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import {
  canPurchaseAskCredits,
  isRevenueCatTestStore,
  loadAskCredits,
  observeAskCredits,
  presentAskCreditsPaywall,
  presentAskCustomerCenter,
  type AskCredits,
} from './revenueCat'

export default function AskCreditsCard({
  account,
  purchasesEnabled,
}: {
  account: string
  purchasesEnabled: boolean
}) {
  const { t } = useTranslation()
  const [plan, setPlan] = useState<AskCredits | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const canPurchase = canPurchaseAskCredits(purchasesEnabled)
  useEffect(() => {
    let active = true
    const fail = () => {
      if (active)
        setError(
          t('askCredits.unavailable', {
            defaultValue: 'Your AI balance is unavailable. Please try again later.',
          })
        )
    }
    const next = (value: AskCredits) => {
      if (active) {
        setPlan(value)
        setError('')
      }
    }
    const stop = observeAskCredits(account, next, fail)
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') void loadAskCredits(account).then(next).catch(fail)
    })
    return () => {
      active = false
      stop()
      listener.remove()
    }
  }, [account, t])
  const run = async (action: () => Promise<AskCredits>) => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const next = await action()
      setPlan(next)
    } catch (cause) {
      if (!(cause as { userCancelled?: boolean })?.userCancelled)
        setError(
          t('askCredits.purchaseError', {
            defaultValue:
              'The store could not complete this request. Check your purchase status before trying again.',
          })
        )
    } finally {
      setBusy(false)
    }
  }
  return (
    <Box className="mt-6 rounded-2xl bg-light-grey p-4">
      <Text className="text-lg font-bold">
        {t('askCredits.title', { defaultValue: 'Your AI balance' })}
      </Text>
      <Text className="mt-2">
        {plan?.available
          ? t('askCredits.balance', { count: plan.balance, defaultValue: '{{count}} credits' })
          : t('askCredits.loading', { defaultValue: 'Balance not available yet' })}
      </Text>
      {isRevenueCatTestStore && (
        <Text className="mt-2 text-sm text-grey">
          {t('askCredits.testStore', {
            defaultValue: 'Test purchases only. No real payment is taken.',
          })}
        </Text>
      )}
      <Text className="mt-2 text-sm text-grey">
        {t('askCredits.explanation', {
          defaultValue:
            'Choose your AI budget. One-time purchases, no renewal. Purchased credits do not expire. Reading and study tools stay free.',
        })}
      </Text>
      {(!canPurchase || (plan?.available && plan.packages.length === 0)) && (
        <Text className="mt-2 text-sm text-grey">
          {t('askCredits.preparing', {
            defaultValue:
              'Credit purchases are not available yet. You can continue using free Ask.',
          })}
        </Text>
      )}
      {canPurchase && !plan?.available && (
        <Text className="mt-2 text-sm text-grey">
          {t('askCredits.appUpdate', {
            defaultValue: 'Credit purchases need the updated app and store setup.',
          })}
        </Text>
      )}
      {canPurchase && plan?.available && plan.packages.length > 0 && (
        <Pressable
          disabled={busy}
          onPress={() => void run(() => presentAskCreditsPaywall(account, purchasesEnabled))}
          className="mt-3 rounded-full bg-primary px-4 py-3"
        >
          <Text className="text-center font-bold text-white">
            {t('askCredits.buy', { defaultValue: 'Choose your AI budget' })}
          </Text>
        </Pressable>
      )}
      {plan?.available && (
        <HStack className="mt-3 flex-wrap gap-4">
          <Pressable
            disabled={busy}
            onPress={() => void run(() => presentAskCustomerCenter(account))}
            className="py-3"
          >
            <Text>{t('askCredits.customerCenter', { defaultValue: 'Purchase help' })}</Text>
          </Pressable>
          <Pressable
            disabled={busy}
            onPress={() => void run(() => loadAskCredits(account))}
            className="py-3"
          >
            <Text>{t('askCredits.refresh', { defaultValue: 'Refresh balance' })}</Text>
          </Pressable>
        </HStack>
      )}
      {!!error && (
        <Text accessibilityRole="alert" className="mt-2 text-sm text-grey">
          {error}
        </Text>
      )}
      <HStack className="mt-3 gap-4">
        <Pressable onPress={() => void Linking.openURL('https://cyberjudah.io/app/privacy')}>
          <Text className="text-xs text-grey">
            {t('askCredits.privacy', { defaultValue: 'Privacy' })}
          </Text>
        </Pressable>
        <Pressable onPress={() => void Linking.openURL('https://cyberjudah.io/app/terms')}>
          <Text className="text-xs text-grey">
            {t('askCredits.terms', { defaultValue: 'Terms' })}
          </Text>
        </Pressable>
      </HStack>
    </Box>
  )
}
