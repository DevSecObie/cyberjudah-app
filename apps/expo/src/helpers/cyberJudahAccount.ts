import { Linking } from 'react-native'

// Native providers already authenticate against the same Firebase project and UID.
// Telegram linking is performed in the authenticated system browser with fresh proof of both accounts.
export async function connectTelegramAccount() {
  const origin = process.env.EXPO_PUBLIC_CYBERJUDAH_API_URL
  if (process.env.EXPO_PUBLIC_RESOURCE_PROFILE !== 'cyberjudah' || !origin) return
  await Linking.openURL(`${origin}/profile`)
}
export async function restoreCyberJudahSession() {}
export async function endCyberJudahSession() {}
