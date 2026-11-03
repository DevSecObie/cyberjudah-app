// When Telegram opens web.cyberjudah.io as its Mini App: tell Telegram the page is ready, sign the
// reader into their Telegram account, open the page a shared link points at, and let Telegram's
// own back button go back. Outside Telegram this does nothing and loads nothing.
import { useNavigationContainerRef, useRouter } from 'expo-router'
import { useEffect } from 'react'
import { API_ORIGIN } from '~features/books/booksData'
import FireAuth from '~helpers/FireAuth'
import { readTelegramLaunch, startParamToRoute } from './telegramLaunch'

type TelegramWebApp = {
  initData: string
  ready: () => void
  expand: () => void
  BackButton: {
    show: () => void
    hide: () => void
    onClick: (cb: () => void) => void
    offClick: (cb: () => void) => void
  }
}
declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

// Read at load, before the router touches the address.
const LAUNCH =
  typeof window === 'undefined'
    ? {}
    : readTelegramLaunch(window.location.hash, window.location.search)
const IN_TELEGRAM = Boolean(LAUNCH.tgWebAppData)

if (IN_TELEGRAM) {
  // Telegram's script reads its launch data from the address, or from here once the address changed.
  try {
    window.sessionStorage.setItem('__telegram__initParams', JSON.stringify(LAUNCH))
  } catch {}
}

let script: Promise<TelegramWebApp | null> | null = null
const loadTelegram = () =>
  (script ??= new Promise(resolve => {
    if (window.Telegram?.WebApp) return resolve(window.Telegram.WebApp)
    const tag = document.createElement('script')
    tag.src = 'https://telegram.org/js/telegram-web-app.js'
    tag.async = true
    tag.onload = () => resolve(window.Telegram?.WebApp ?? null)
    tag.onerror = () => resolve(null)
    document.head.appendChild(tag)
  }))

const TelegramMiniApp = () => {
  const router = useRouter()
  const navigation = useNavigationContainerRef()

  useEffect(() => {
    if (!IN_TELEGRAM) return
    let alive = true
    let onBack: (() => void) | null = null
    let stopListening: (() => void) | undefined
    void loadTelegram().then(webApp => {
      if (!alive || !webApp) return
      webApp.ready()
      webApp.expand()
      void FireAuth.loginWithTelegram(webApp.initData || LAUNCH.tgWebAppData, API_ORIGIN)
      const route = startParamToRoute(LAUNCH.tgWebAppStartParam)
      if (route) router.push(route as never)
      // Telegram's back button stands for the app's own back, shown whenever there is a page to go back to.
      onBack = () => router.back()
      webApp.BackButton.onClick(onBack)
      const sync = () => (router.canGoBack() ? webApp.BackButton.show() : webApp.BackButton.hide())
      sync()
      stopListening = navigation.addListener('state', sync)
    })
    return () => {
      alive = false
      stopListening?.()
      if (onBack) window.Telegram?.WebApp?.BackButton.offClick(onBack)
    }
  }, [navigation, router])

  return null
}

export default TelegramMiniApp
