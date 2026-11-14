import * as ExpoHaptics from 'expo-haptics'
import { ImpactFeedbackStyle, NotificationFeedbackType } from 'expo-haptics'
import { telegramHaptics } from './telegramMiniApp'

export { ImpactFeedbackStyle, NotificationFeedbackType } from 'expo-haptics'

// Inside Telegram the phone taps and buzzes through Telegram, which names the styles and types
// as Expo does ('light', 'success', ...). Elsewhere on the web, Expo's own web behaviour.

export const impactAsync = async (style: ImpactFeedbackStyle = ImpactFeedbackStyle.Medium) => {
  const haptics = telegramHaptics()
  if (haptics) return haptics.impactOccurred(style)
  return ExpoHaptics.impactAsync(style)
}

export const notificationAsync = async (
  type: NotificationFeedbackType = NotificationFeedbackType.Success
) => {
  const haptics = telegramHaptics()
  if (haptics) return haptics.notificationOccurred(type)
  return ExpoHaptics.notificationAsync(type)
}

export const selectionAsync = async () => {
  const haptics = telegramHaptics()
  if (haptics) return haptics.selectionChanged()
  return ExpoHaptics.selectionAsync()
}

export { AndroidHaptics, performAndroidHapticsAsync } from 'expo-haptics'
