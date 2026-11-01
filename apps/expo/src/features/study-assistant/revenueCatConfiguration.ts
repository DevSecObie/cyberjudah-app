export type RevenueCatKeyOptions = {
  platform: string
  development: boolean
  staging: boolean
  testKey?: string
  iosKey?: string
  androidKey?: string
}

/** Test Store keys must never configure an SDK compiled for TestFlight or a public store. */
export function revenueCatPublicKey(options: RevenueCatKeyOptions): string | undefined {
  if (!['ios', 'android'].includes(options.platform)) return undefined
  if (options.development && options.staging && /^test_[A-Za-z0-9]+$/.test(options.testKey || '')) {
    return options.testKey
  }
  const key = options.platform === 'ios' ? options.iosKey : options.androidKey
  const prefix = options.platform === 'ios' ? 'appl_' : 'goog_'
  return key?.startsWith(prefix) && /^[A-Za-z0-9_]+$/.test(key) ? key : undefined
}
