import { Platform } from 'react-native'
import { telegramPhone } from './telegramMiniApp'

/**
 * The phone whose look the app takes. The phone apps take their own; the web app opened inside
 * Telegram takes the look of the phone Telegram runs on, so it matches the iPhone or Android
 * app there; everywhere else on the web it is the web.
 */
const os = Platform?.OS
export const LOOK_OS: 'ios' | 'android' | 'web' =
  os === 'ios' || os === 'android' ? os : (telegramPhone() ?? 'web')

/** Inside Telegram on a phone, where the web app takes that phone's look. */
export const IS_TELEGRAM_PHONE = os !== 'ios' && os !== 'android' && LOOK_OS !== 'web'
