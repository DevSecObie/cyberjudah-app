// The app opened as a Telegram Mini App exists only on the web (telegramMiniApp.web.ts). The
// phone apps are never inside Telegram.

export type TelegramPhone = 'ios' | 'android'

export type TelegramHapticFeedback = {
  impactOccurred: (style: string) => void
  notificationOccurred: (type: string) => void
  selectionChanged: () => void
}

export const telegramPhone = (): TelegramPhone | undefined => undefined

export const telegramHaptics = (): TelegramHapticFeedback | undefined => undefined
