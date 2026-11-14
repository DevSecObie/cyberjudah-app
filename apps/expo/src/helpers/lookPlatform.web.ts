import { telegramPhone } from './telegramMiniApp'

// The web side of lookPlatform.ts: inside Telegram on a phone, that phone; elsewhere the web.
export const LOOK_OS: 'ios' | 'android' | 'web' = telegramPhone() ?? 'web'

export const IS_TELEGRAM_PHONE = LOOK_OS !== 'web'
