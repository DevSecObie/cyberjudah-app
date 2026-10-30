import { useRouter } from 'expo-router'
import { Linking } from 'react-native'
import { getCommentaryBibleViewRoute } from '~features/commentaries/commentaryReferenceNavigation'
import { readCachedClassLibrary } from '~features/passageMediaLibrary/cyberJudahClasses'
import { cyberJudahSiteLinkToOsis } from '~helpers/cyberJudahSiteLinks'

const SITE = 'https://cyberjudah.io'

/**
 * Opens a cyberjudah.io address in the app's own screen when there is one: a Bible passage, a
 * class (its player), a note, a topic, a false doctrine, a precept or a case. Anything else opens
 * in the browser.
 */
export const useOpenSiteLink = () => {
  const router = useRouter()

  const openClassVideo = (video: string) => {
    const item = readCachedClassLibrary()?.find(row => row.providerId === video)
    if (!item) return false
    router.push({ pathname: '/(explore)/passage-media-player', params: { workId: item.workId } })
    return true
  }

  const open = (href: string) => {
    if (href.startsWith('bible://')) {
      const route = getCommentaryBibleViewRoute(href.slice('bible://'.length))
      if (route) router.push(route)
      return
    }
    const url = href.startsWith('/') ? `${SITE}${href}` : href
    const osis = cyberJudahSiteLinkToOsis(url)
    if (osis) {
      const route = getCommentaryBibleViewRoute(osis)
      if (route) return router.push(route)
    }
    const site = /^https:\/\/cyberjudah\.io(\/[a-z0-9/_-]*)/i.exec(url)
    const path = site?.[1].replace(/\/$/, '') ?? ''
    const [, section = '', slug = ''] = /^\/([a-z]+)\/?(.*)$/i.exec(path) ?? []
    if (/^(classes|captains|history)$/.test(section) && slug) {
      const item = readCachedClassLibrary()?.find(row => row.notesPath === path)
      if (item) {
        return router.push({
          pathname: '/(explore)/passage-media-player',
          params: { workId: item.workId },
        })
      }
      return router.push({ pathname: '/(explore)/published-note', params: { path } })
    }
    if (/^(study|encyclopedia)$/.test(section) && slug)
      return router.push({ pathname: '/(explore)/published-note', params: { path } })
    if (section === 'topics' && slug)
      return router.push({ pathname: '/(explore)/topic', params: { slug } })
    if (section === 'doctrine' && slug)
      return router.push({ pathname: '/(explore)/false-doctrine', params: { slug } })
    if (section === 'precepts' && slug)
      return router.push({ pathname: '/(explore)/precept', params: { slug } })
    if (section === 'cases' && slug)
      return router.push({ pathname: '/(explore)/case-study', params: { slug } })
    const video = /youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})/.exec(url)?.[1]
    if (video && openClassVideo(video)) return
    if (/^https:\/\//.test(url)) void Linking.openURL(url)
  }

  /** A moment of a class: its player when the class is in the library, else the recording. */
  const openMoment = (moment: { video: string; t?: number; note?: string }) => {
    if (openClassVideo(moment.video)) return
    if (moment.note) return open(moment.note.replace(/\?.*$/, ''))
    void Linking.openURL(
      `https://www.youtube.com/watch?v=${moment.video}${moment.t ? `&t=${moment.t}s` : ''}`
    )
  }

  return { open, openMoment }
}

/** Seconds as the classes' clock: 1:52:04 or 12:38. */
export const clock = (seconds: number) => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = String(Math.floor(seconds % 60)).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}
