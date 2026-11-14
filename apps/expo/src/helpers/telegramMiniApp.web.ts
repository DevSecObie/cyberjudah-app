import type { TelegramHapticFeedback, TelegramPhone } from './telegramMiniApp'

export type { TelegramHapticFeedback, TelegramPhone } from './telegramMiniApp'

// index.html loads Telegram's Mini App script before the app only when Telegram opened the page,
// so on the open web there is no `Telegram.WebApp`, and outside Telegram's launch it has no data.
type TelegramWebApp = {
  initData?: string
  platform?: string
  isVersionAtLeast?: (version: string) => boolean
  HapticFeedback?: TelegramHapticFeedback
}

const webApp = (): TelegramWebApp | undefined => {
  const app = (globalThis as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp
  return app?.initData ? app : undefined
}

/** The phone Telegram runs on: its own name for iPhone and iPad, and for its Android apps. */
export const telegramPhone = (): TelegramPhone | undefined => {
  const platform = webApp()?.platform ?? ''
  if (platform === 'ios') return 'ios'
  if (platform.startsWith('android')) return 'android'
  return undefined
}

/** Telegram's haptics, from Telegram 6.1, which make the phone tap or buzz like its own apps. */
export const telegramHaptics = (): TelegramHapticFeedback | undefined => {
  const app = webApp()
  try {
    return app?.isVersionAtLeast?.('6.1') ? app.HapticFeedback : undefined
  } catch {
    return undefined
  }
}
