import { Platform } from 'react-native'

/**
 * The phone whose look the app takes. The phone apps take their own; on the web
 * (lookPlatform.web.ts), the web app opened inside Telegram takes the look of the phone Telegram
 * runs on, so it matches the iPhone or Android app there, and is the web everywhere else.
 */
export const LOOK_OS: 'ios' | 'android' | 'web' =
  Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web'

/** Inside Telegram on a phone, where the web app takes that phone's look. */
export const IS_TELEGRAM_PHONE = false
