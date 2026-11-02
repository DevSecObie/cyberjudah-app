import { atom, getDefaultStore, useAtomValue } from 'jotai'
import { Linking, Platform } from 'react-native'

const inAppBrowserUrlAtom = atom<string | undefined>(undefined)

/**
 * Opens a link without leaving CyberJudah: a web page opens on the in-app browser sheet
 * (InAppBrowserHost). Mail, phone and App Store links, and every link on the web build, go to
 * the system as before.
 */
export const openInApp = (url: string) => {
  if (Platform.OS !== 'web' && /^https?:\/\//iu.test(url)) {
    getDefaultStore().set(inAppBrowserUrlAtom, url)
    return
  }
  void Linking.openURL(url).catch(() => {})
}

export const closeInApp = () => getDefaultStore().set(inAppBrowserUrlAtom, undefined)

export const useInAppBrowserUrl = () => useAtomValue(inAppBrowserUrlAtom)
