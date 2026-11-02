import type { PurchasesPackage } from 'react-native-purchases'
import { getCurrentAuthUser } from '~helpers/firebaseAuthRuntime'

// The browser has no store to buy Ask credits from: revenueCatPublicKey() gives no key on web,
// so revenueCat.ts already answers "unavailable" here. This web copy gives the same answers
// without pulling the purchases SDK (about 1 MB) into the web bundle. The phone app is unchanged.

export const ASK_CURRENCY = 'ASK'
export const ASK_CREDIT_OFFERING = 'ask_credits'
const staging = process.env.EXPO_PUBLIC_ACCOUNT_SYNC_SCOPE === 'staging'
export const revenueCatAccountId = (uid: string) => `${staging ? 'staging:' : ''}${uid}`
export const isRevenueCatTestStore = false
export const canPurchaseAskCredits = (_serverEnabled: boolean) => false

export type AskCredits = {
  available: boolean
  balance: number
  packages: PurchasesPackage[]
}
const unavailable: AskCredits = { available: false, balance: 0, packages: [] }

export async function loadAskCredits(_uid: string): Promise<AskCredits> {
  return unavailable
}

export function observeAskCredits(
  uid: string,
  next: (plan: AskCredits) => void,
  _error: () => void
) {
  let active = true
  void Promise.resolve().then(() => {
    if (active && getCurrentAuthUser()?.uid === uid) next(unavailable)
  })
  return () => {
    active = false
  }
}

export async function purchaseAskCredits(
  _uid: string,
  _item: PurchasesPackage,
  _serverEnabled: boolean
): Promise<AskCredits> {
  throw new Error('BILLING_NOT_READY')
}

export async function presentAskCreditsPaywall(
  _uid: string,
  _serverEnabled: boolean
): Promise<AskCredits> {
  throw new Error('BILLING_NOT_READY')
}

export async function presentAskCustomerCenter(uid: string): Promise<AskCredits> {
  if (!uid || getCurrentAuthUser()?.uid !== uid) throw new Error('BILLING_ACCOUNT_CHANGED')
  throw new Error('BILLING_NOT_CONFIGURED')
}
