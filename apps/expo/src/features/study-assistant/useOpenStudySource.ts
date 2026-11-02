import { useRouter } from 'expo-router'
import { useSetAtom } from 'jotai'
import { dockedClassAtom } from '~features/passageMediaLibrary/dockedClassPlayerStore'
import { useOpenSiteLink } from '~features/publishedNotes/siteLinks'
import {
  loadClassLibrary,
  readCachedClassLibrary,
} from '~features/passageMediaLibrary/cyberJudahClasses'
import { sourceLink, type CyberJudahSource } from './cyberJudahAsk'
import { studySourceRoute } from './askStudyNavigation'

export function useOpenStudySource() {
  const router = useRouter()
  const links = useOpenSiteLink()
  const setDocked = useSetAtom(dockedClassAtom)
  return async (source: CyberJudahSource) => {
    if (source.video && /^[A-Za-z0-9_-]{11}$/.test(source.video)) {
      // A class moment plays in the floating player at the cited second, so the answer stays open
      // under it to read along; the player's arrow opens the class page.
      const rows = readCachedClassLibrary() ?? (await loadClassLibrary().catch(() => []))
      const item = rows.find(row => row.providerId === source.video)
      const start = Math.max(0, Math.floor(source.t ?? 0))
      setDocked({
        videoId: source.video,
        title: source.title,
        start,
        returnTo: {
          pathname: '/(explore)/passage-media-player',
          params: {
            // Transcript search also finds recordings outside the published class catalog.
            // The existing player supports those by video ID and retains the cited time.
            ...(item ? { workId: item.workId } : { video: source.video, title: source.title }),
            start: String(start),
          },
        },
      })
      return
    }
    const route = studySourceRoute(source)
    if (route) {
      router.push(route)
      return
    }
    const url = sourceLink(source)
    if (url) links.open(url)
  }
}
