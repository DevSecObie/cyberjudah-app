import notifee, { EventType } from '@notifee/react-native'
import { useRootNavigationState, useRouter } from 'expo-router'
import { useEffect } from 'react'
import { AppState, Platform } from 'react-native'
import { usesCyberJudahEditorial } from '~helpers/editorialProfile'
import { readCachedClassLibrary } from '~features/passageMediaLibrary/cyberJudahClasses'
import { takeNewClassPress } from './newClassAlertInbox.native'
import { loadMessaging } from './newClassAlerts.native'
import { NEW_CLASS_CHANNEL, readNewClassPress, type NewClassPress } from './newClassAlertRules'

/** The launch alert is read once per launch, not again when navigation remounts. */
let launchAlertRead = false

/**
 * Opens the class an alert names, the way the live-class banner does: the class page when the
 * class is already in the library, the player straight on the video when it is too new.
 */
const NewClassAlerts = () => {
  const router = useRouter()
  const navigation = useRootNavigationState()
  const cyberJudah = usesCyberJudahEditorial()

  useEffect(() => {
    if (!cyberJudah || !navigation?.key) return
    const loaded = loadMessaging()
    let active = true
    const open = (press: NewClassPress | undefined) => {
      if (!active || !press) return
      const listed = readCachedClassLibrary()?.find(item => item.providerId === press.video)
      router.push({
        pathname: '/(explore)/passage-media-player',
        params: listed
          ? { workId: listed.workId }
          : { video: press.video, ...(press.title ? { title: press.title } : {}) },
      })
    }
    open(takeNewClassPress())
    const stops: (() => void)[] = []
    if (loaded) {
      const { module, messaging } = loaded
      // Tapped while the app was closed.
      if (!launchAlertRead) {
        launchAlertRead = true
        module
          .getInitialNotification(messaging)
          .then(message => open(readNewClassPress(message?.data)))
          .catch(() => {
            /* A normal launch has none. */
          })
      }
      // Tapped while the app was in the background.
      stops.push(
        module.onNotificationOpenedApp(messaging, message => open(readNewClassPress(message.data)))
      )
      // Android shows nothing for a message that arrives while the app is open; iPhone shows it
      // itself (firebase.json, messaging_ios_foreground_presentation_options).
      if (Platform.OS === 'android')
        stops.push(
          module.onMessage(messaging, message => {
            const press = readNewClassPress(message.data)
            if (!press) return
            void notifee
              .displayNotification({
                title: message.notification?.title ?? 'New class',
                body: message.notification?.body ?? press.title,
                data: { kind: 'new-class', video: press.video, title: press.title ?? '' },
                android: { channelId: NEW_CLASS_CHANNEL, pressAction: { id: 'default' } },
              })
              .catch(() => {
                /* The alert is a courtesy; the class is in the list either way. */
              })
          })
        )
    }
    stops.push(
      notifee.onForegroundEvent(({ type, detail }) => {
        if (type === EventType.PRESS) open(readNewClassPress(detail.notification?.data))
      })
    )
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') open(takeNewClassPress())
    })
    return () => {
      active = false
      stops.forEach(stop => stop())
      subscription.remove()
    }
  }, [cyberJudah, navigation?.key, router])

  return null
}

export default NewClassAlerts
