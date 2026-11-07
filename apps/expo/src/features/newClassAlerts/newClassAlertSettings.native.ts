import notifee, { AndroidImportance, AuthorizationStatus } from '@notifee/react-native'
import * as Updates from 'expo-updates'
import { Platform } from 'react-native'
import { createMMKV } from 'react-native-mmkv'
import { NEW_CLASS_CHANNEL, newClassTopic } from './newClassAlertRules'

type MessagingModule = typeof import('@react-native-firebase/messaging')

/**
 * Firebase Messaging is a native module: a build made before it was added has none, and an
 * over-the-air update must not crash there. Every call goes through this and gives up quietly.
 */
export const loadMessaging = (): { module: MessagingModule; messaging: any } | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require('@react-native-firebase/messaging') as MessagingModule
    return { module, messaging: module.getMessaging() }
  } catch {
    return null
  }
}

const store = createMMKV({ id: 'new-class-alerts' })
const KEY = 'enabled'

export const newClassAlertsAvailable = () => loadMessaging() !== null

export const readNewClassAlertsChoice = () => store.getBoolean(KEY) === true

export type NewClassAlertsResult = 'on' | 'off' | 'denied' | 'unavailable' | 'error'

const topic = () => newClassTopic(Updates.channel)

/**
 * Turns alerts on: asks for permission (the same prompt the reading reminders use), registers
 * the phone with Apple or Google, and joins the topic. Nothing is sent to CyberJudah's server.
 */
export const enableNewClassAlerts = async (): Promise<NewClassAlertsResult> => {
  const loaded = loadMessaging()
  if (!loaded) return 'unavailable'
  try {
    const settings = await notifee.requestPermission()
    if (settings.authorizationStatus < AuthorizationStatus.AUTHORIZED) return 'denied'
    if (Platform.OS === 'android') {
      await notifee.createChannel({
        id: NEW_CLASS_CHANNEL,
        name: 'New classes',
        importance: AndroidImportance.DEFAULT,
      })
      if (await notifee.isChannelBlocked(NEW_CLASS_CHANNEL)) return 'denied'
    }
    const { module, messaging } = loaded
    await module.setAutoInitEnabled(messaging, true)
    if (!module.isDeviceRegisteredForRemoteMessages(messaging))
      await module.registerDeviceForRemoteMessages(messaging)
    await module.subscribeToTopic(messaging, topic())
    store.set(KEY, true)
    return 'on'
  } catch {
    return 'error'
  }
}

/**
 * Turns alerts off: leaves the topic, then deletes the phone's Firebase token. The choice is saved
 * as off only once the phone has left the topic: if that fails (offline, say), the phone would still
 * get alerts, so the switch stays on and shows the error instead.
 */
export const disableNewClassAlerts = async (): Promise<NewClassAlertsResult> => {
  const loaded = loadMessaging()
  if (!loaded) {
    // No messaging in this build: it can't be subscribed.
    store.set(KEY, false)
    return 'off'
  }
  const { module, messaging } = loaded
  try {
    await module.unsubscribeFromTopic(messaging, topic())
  } catch {
    return 'error'
  }
  store.set(KEY, false)
  try {
    // Off the topic already; the token and auto-init are tidying, so a failure here doesn't
    // turn the switch back on.
    await module.deleteToken(messaging)
    await module.setAutoInitEnabled(messaging, false)
  } catch {}
  return 'off'
}
