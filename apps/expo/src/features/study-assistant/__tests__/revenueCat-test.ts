import { getCurrentAuthUser } from '~helpers/firebaseAuthRuntime'
import Purchases from 'react-native-purchases'
import RevenueCatUI from 'react-native-purchases-ui'

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  NativeModules: { RNPurchases: {}, RNPaywalls: {}, RNCustomerCenter: {} },
}))
jest.mock('~helpers/firebaseAuthRuntime', () => ({ getCurrentAuthUser: jest.fn() }))
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    isConfigured: jest.fn(),
    configure: jest.fn(),
    getAppUserID: jest.fn(),
    logIn: jest.fn(),
    getVirtualCurrencies: jest.fn(),
    invalidateVirtualCurrenciesCache: jest.fn(),
    getOfferings: jest.fn(),
    purchasePackage: jest.fn(),
    addCustomerInfoUpdateListener: jest.fn(),
    removeCustomerInfoUpdateListener: jest.fn(),
  },
}))
jest.mock('react-native-purchases-ui', () => ({
  __esModule: true,
  default: { presentPaywall: jest.fn(), presentCustomerCenter: jest.fn() },
  PAYWALL_RESULT: { ERROR: 'ERROR', CANCELLED: 'CANCELLED', PURCHASED: 'PURCHASED' },
}))
const pack = {
  identifier: 'ask_small',
  packageType: 'CUSTOM',
  product: {
    identifier: 'ask_credits_small',
    productCategory: 'NON_SUBSCRIPTION',
    productType: 'CONSUMABLE',
  },
}
const offerings = (packages: unknown[] = [pack]) => ({
  current: { identifier: 'default', availablePackages: [] },
  all: { ask_credits: { identifier: 'ask_credits', availablePackages: packages } },
})
beforeEach(() => {
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = 'appl_fixture_public_key'
  process.env.EXPO_PUBLIC_ACCOUNT_SYNC_SCOPE = 'staging'
  process.env.EXPO_PUBLIC_ASK_PURCHASES_ENABLED = 'true'
  jest.resetAllMocks()
  ;(getCurrentAuthUser as jest.Mock).mockReturnValue({ uid: 'alice' })
  ;(Purchases.isConfigured as jest.Mock).mockResolvedValue(true)
  ;(Purchases.getAppUserID as jest.Mock).mockResolvedValue('staging:alice')
  ;(Purchases.getVirtualCurrencies as jest.Mock).mockResolvedValue({
    all: { ASK: { balance: 12 } },
  })
  ;(Purchases.getOfferings as jest.Mock).mockResolvedValue(offerings())
})
it('keeps staging receipts separate and refuses real purchases without server readiness', async () => {
  const { revenueCatAccountId, purchaseAskCredits, presentAskCreditsPaywall } =
    await import('../revenueCat')
  expect(revenueCatAccountId('alice')).toBe('staging:alice')
  await expect(purchaseAskCredits('alice', pack as never, false)).rejects.toThrow(
    'BILLING_NOT_READY'
  )
  await expect(presentAskCreditsPaywall('alice', false)).rejects.toThrow('BILLING_NOT_READY')
  expect(Purchases.purchasePackage).not.toHaveBeenCalled()
  expect(RevenueCatUI.presentPaywall).not.toHaveBeenCalled()
})
it('uses Firebase UID and the dedicated credit offering instead of the old subscription offering', async () => {
  const { loadAskCredits } = await import('../revenueCat')
  ;(Purchases.getAppUserID as jest.Mock).mockResolvedValue('staging:previous-user')
  const wallet = await loadAskCredits('alice')
  expect(Purchases.logIn).toHaveBeenCalledWith('staging:alice')
  expect(wallet).toMatchObject({ balance: 12, packages: [pack] })
  expect(Purchases.invalidateVirtualCurrenciesCache).toHaveBeenCalled()
})
it('blocks a stale account from reading another login’s balance', async () => {
  const { loadAskCredits } = await import('../revenueCat')
  ;(getCurrentAuthUser as jest.Mock).mockReturnValue({ uid: 'bob' })
  await expect(loadAskCredits('alice')).rejects.toThrow('BILLING_ACCOUNT_CHANGED')
  expect(Purchases.getVirtualCurrencies).not.toHaveBeenCalled()
})
it('opens the credit pack selector even when a customer already has credit', async () => {
  const { presentAskCreditsPaywall } = await import('../revenueCat')
  ;(RevenueCatUI.presentPaywall as jest.Mock).mockResolvedValue('CANCELLED')
  expect((await presentAskCreditsPaywall('alice', true)).balance).toBe(12)
  expect(RevenueCatUI.presentPaywall).toHaveBeenCalledWith(
    expect.objectContaining({
      offering: expect.objectContaining({ identifier: 'ask_credits' }),
      displayCloseButton: true,
    })
  )
})
it('does not mint credits from a PURCHASED result', async () => {
  const { presentAskCreditsPaywall } = await import('../revenueCat')
  ;(RevenueCatUI.presentPaywall as jest.Mock).mockResolvedValue('PURCHASED')
  expect((await presentAskCreditsPaywall('alice', true)).balance).toBe(12)
})
it('reads the updated server balance after a successful pack purchase', async () => {
  const { purchaseAskCredits } = await import('../revenueCat')
  ;(Purchases.purchasePackage as jest.Mock).mockImplementation(async () => {
    ;(Purchases.getVirtualCurrencies as jest.Mock).mockResolvedValue({
      all: { ASK: { balance: 112 } },
    })
    return { customerInfo: { entitlements: { active: {} } } }
  })
  expect((await purchaseAskCredits('alice', pack as never, true)).balance).toBe(112)
  expect(Purchases.purchasePackage).toHaveBeenCalledWith(pack)
})
it('blocks checkout if the Firebase account changes while the selector is open', async () => {
  const { presentAskCreditsPaywall } = await import('../revenueCat')
  const resume = jest.fn()
  ;(RevenueCatUI.presentPaywall as jest.Mock).mockImplementation(async options => {
    ;(getCurrentAuthUser as jest.Mock).mockReturnValue({ uid: 'bob' })
    options.callbacks.onPurchasePackageInitiated({ packageBeingPurchased: pack, resume })
    return 'CANCELLED'
  })
  await expect(presentAskCreditsPaywall('alice', true)).rejects.toThrow('BILLING_ACCOUNT_CHANGED')
  expect(resume).toHaveBeenCalledWith(false)
})
it('rejects subscriptions, lifetime unlocks and a mixed offering', async () => {
  const { purchaseAskCredits, presentAskCreditsPaywall } = await import('../revenueCat')
  const lifetime = { ...pack, product: { ...pack.product, productType: 'NON_CONSUMABLE' } }
  await expect(purchaseAskCredits('alice', lifetime as never, true)).rejects.toThrow(
    'BILLING_PRODUCT_UNAVAILABLE'
  )
  ;(Purchases.getOfferings as jest.Mock).mockResolvedValue(offerings([pack, lifetime]))
  await expect(presentAskCreditsPaywall('alice', true)).rejects.toThrow(
    'BILLING_PRODUCTS_NOT_CONFIGURED'
  )
  expect(RevenueCatUI.presentPaywall).not.toHaveBeenCalled()
})
it('rejects a stale product that is no longer in the credit offering', async () => {
  const { purchaseAskCredits } = await import('../revenueCat')
  ;(Purchases.getOfferings as jest.Mock).mockResolvedValue(offerings([]))
  await expect(purchaseAskCredits('alice', pack as never, true)).rejects.toThrow(
    'BILLING_PRODUCT_UNAVAILABLE'
  )
  expect(Purchases.purchasePackage).not.toHaveBeenCalled()
})
it('refreshes balance after purchase support closes', async () => {
  const { presentAskCustomerCenter } = await import('../revenueCat')
  await presentAskCustomerCenter('alice')
  expect(RevenueCatUI.presentCustomerCenter).toHaveBeenCalled()
  expect(Purchases.invalidateVirtualCurrenciesCache).toHaveBeenCalled()
})
it('rejects invalid balances instead of displaying spendable credit', async () => {
  const { loadAskCredits } = await import('../revenueCat')
  ;(Purchases.getVirtualCurrencies as jest.Mock).mockResolvedValue({
    all: { ASK: { balance: -1 } },
  })
  await expect(loadAskCredits('alice')).rejects.toThrow('BILLING_INVALID_BALANCE')
})
