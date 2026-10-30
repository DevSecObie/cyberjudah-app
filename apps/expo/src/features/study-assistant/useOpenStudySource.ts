import { useRouter } from 'expo-router'
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
  return async (source: CyberJudahSource) => {
    if (source.video && /^[A-Za-z0-9_-]{11}$/.test(source.video)) {
      const rows = readCachedClassLibrary() ?? (await loadClassLibrary().catch(() => []))
      const item = rows.find(row => row.providerId === source.video)
      // Transcript search also finds recordings outside the published class catalog.
      // The existing player supports those by video ID and retains the cited time.
      router.push({
        pathname: '/(explore)/passage-media-player',
        params: {
          ...(item ? { workId: item.workId } : { video: source.video, title: source.title }),
          start: String(source.t ?? 0),
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
