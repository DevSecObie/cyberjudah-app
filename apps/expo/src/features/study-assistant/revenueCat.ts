import { NativeModules, Platform } from 'react-native'
import type { PurchasesPackage } from 'react-native-purchases'
import { getCurrentAuthUser } from '~helpers/firebaseAuthRuntime'
import { revenueCatPublicKey } from './revenueCatConfiguration'

export const ASK_CURRENCY = 'ASK'
export const ASK_CREDIT_OFFERING = 'ask_credits'
const CREDIT_PACKAGES = new Set(['ask_small', 'ask_medium', 'ask_large'])
const enabled = process.env.EXPO_PUBLIC_ASK_PURCHASES_ENABLED === 'true'
const staging = process.env.EXPO_PUBLIC_ACCOUNT_SYNC_SCOPE === 'staging'
export const revenueCatAccountId = (uid: string) => `${staging ? 'staging:' : ''}${uid}`
const publicKey = revenueCatPublicKey({
  platform: Platform.OS,
  development: typeof __DEV__ !== 'undefined' && __DEV__,
  staging,
  testKey: process.env.EXPO_PUBLIC_REVENUECAT_TEST_KEY,
  iosKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  androidKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
})
export const isRevenueCatTestStore = publicKey?.startsWith('test_') === true
export const canPurchaseAskCredits = (serverEnabled: boolean) =>
  !!publicKey && (isRevenueCatTestStore || (enabled && serverEnabled))
let queue: Promise<unknown> = Promise.resolve()
type SDK = typeof import('react-native-purchases').default

export type AskCredits = {
  available: boolean
  balance: number
  packages: PurchasesPackage[]
}
const unavailable: AskCredits = {
  available: false,
  balance: 0,
  packages: [],
}
const supportedPackage = (item: PurchasesPackage) =>
  CREDIT_PACKAGES.has(item.identifier) &&
  item.packageType === 'CUSTOM' &&
  item.product.productCategory === 'NON_SUBSCRIPTION' &&
  item.product.productType === 'CONSUMABLE'

/** A stale account never purchases under a different app login. SDK identity is serialized. */
const assertAccount = (uid: string) => {
  if (!uid || getCurrentAuthUser()?.uid !== uid) throw new Error('BILLING_ACCOUNT_CHANGED')
}
const forAccount = async <T>(uid: string, task: (sdk: SDK) => Promise<T>): Promise<T> => {
  const work = queue
    .catch(() => {})
    .then(async () => {
      assertAccount(uid)
      // The old development client remains usable before its next native rebuild.
      if (!publicKey || !NativeModules.RNPurchases) throw new Error('BILLING_NOT_CONFIGURED')
      const sdk = (await import('react-native-purchases')).default
      if (!(await sdk.isConfigured())) {
        sdk.configure({
          apiKey: publicKey,
          appUserID: revenueCatAccountId(uid),
          automaticDeviceIdentifierCollectionEnabled: false,
        })
      } else if ((await sdk.getAppUserID()) !== revenueCatAccountId(uid)) {
        await sdk.logIn(revenueCatAccountId(uid))
      }
      assertAccount(uid)
      const result = await task(sdk)
      assertAccount(uid)
      return result
    })
  queue = work.then(
    () => {},
    () => {}
  )
  return work
}
async function readCredits(sdk: SDK): Promise<AskCredits> {
  // Balances do not emit CustomerInfo changes when the server spends credits.
  await sdk.invalidateVirtualCurrenciesCache()
  const currencies = await sdk.getVirtualCurrencies()
  const balance = currencies.all[ASK_CURRENCY]?.balance ?? 0
  if (!Number.isSafeInteger(balance) || balance < 0) throw new Error('BILLING_INVALID_BALANCE')
  const offerings = enabled || isRevenueCatTestStore ? await sdk.getOfferings() : null
  return {
    available: true,
    balance,
    packages: offerings?.all[ASK_CREDIT_OFFERING]?.availablePackages.filter(supportedPackage) ?? [],
  }
}
export async function loadAskCredits(uid: string): Promise<AskCredits> {
  if (!publicKey || !NativeModules.RNPurchases) return unavailable
  return forAccount(uid, readCredits)
}

/** Purchase notifications are re-read for the active UID, never trusted from a stale callback. */
export function observeAskCredits(
  uid: string,
  next: (plan: AskCredits) => void,
  error: () => void
) {
  let active = true
  let refreshing = false
  let remove = () => {}
  const refresh = async () => {
    if (!active || refreshing || getCurrentAuthUser()?.uid !== uid) return
    refreshing = true
    try {
      const plan = await loadAskCredits(uid)
      if (active) next(plan)
    } catch {
      if (active && getCurrentAuthUser()?.uid === uid) error()
    } finally {
      refreshing = false
    }
  }
  if (publicKey && NativeModules.RNPurchases) {
    void forAccount(uid, async sdk => {
      if (!active) return
      const listener = () => {
        void refresh()
      }
      sdk.addCustomerInfoUpdateListener(listener)
      remove = () => {
        sdk.removeCustomerInfoUpdateListener(listener)
      }
    })
      .then(() => {
        if (active) void refresh()
      })
      .catch(() => {
        if (active) error()
      })
  } else void refresh()
  return () => {
    active = false
    remove()
  }
}
/** Consumable balances belong to the Firebase account. Re-signing in restores the remaining
 * balance; calling the store's restore API must never regrant already spent consumables. */
export async function purchaseAskCredits(
  uid: string,
  item: PurchasesPackage,
  serverEnabled: boolean
) {
  if (!canPurchaseAskCredits(serverEnabled)) throw new Error('BILLING_NOT_READY')
  if (!supportedPackage(item)) throw new Error('BILLING_PRODUCT_UNAVAILABLE')
  return forAccount(uid, async sdk => {
    const offering = (await sdk.getOfferings()).all[ASK_CREDIT_OFFERING]
    const current = offering?.availablePackages.find(
      pack =>
        supportedPackage(pack) &&
        pack.identifier === item.identifier &&
        pack.product.identifier === item.product.identifier
    )
    if (!current) throw new Error('BILLING_PRODUCT_UNAVAILABLE')
    assertAccount(uid)
    await sdk.purchasePackage(current)
    // Never add credits locally or infer their amount from the checkout result.
    return readCredits(sdk)
  })
}
async function billingUI() {
  if (!NativeModules.RNPaywalls || !NativeModules.RNCustomerCenter)
    throw new Error('BILLING_REBUILD_REQUIRED')
  return import('react-native-purchases-ui')
}
export async function presentAskCreditsPaywall(uid: string, serverEnabled: boolean) {
  if (!canPurchaseAskCredits(serverEnabled)) throw new Error('BILLING_NOT_READY')
  return forAccount(uid, async sdk => {
    const offering = (await sdk.getOfferings()).all[ASK_CREDIT_OFFERING]
    if (
      !offering ||
      !offering.availablePackages.length ||
      !offering.availablePackages.every(supportedPackage)
    )
      throw new Error('BILLING_PRODUCTS_NOT_CONFIGURED')
    const { default: ui, PAYWALL_RESULT } = await billingUI()
    assertAccount(uid)
    const result = await ui.presentPaywall({
      offering,
      displayCloseButton: true,
      callbacks: {
        onPurchasePackageInitiated: ({ packageBeingPurchased, resume }) => {
          resume(
            getCurrentAuthUser()?.uid === uid &&
              supportedPackage(packageBeingPurchased) &&
              canPurchaseAskCredits(serverEnabled)
          )
        },
      },
    })
    if (result === PAYWALL_RESULT.ERROR) throw new Error('BILLING_PAYWALL_FAILED')
    // Always show the pack selector, including for customers who already have credits.
    // The server balance, never a PURCHASED result or an entitlement, is authoritative.
    return readCredits(sdk)
  })
}
export async function presentAskCustomerCenter(uid: string) {
  return forAccount(uid, async sdk => {
    const { default: ui } = await billingUI()
    await ui.presentCustomerCenter()
    return readCredits(sdk)
  })
}
