import type { ClassCollection, CyberJudahClass } from './cyberJudahClasses'

// The site's own search over every published note (cyberjudah.io/search.json), the same index
// the website and the Telegram app read. It is public and needs no sign-in.
const SITE_ORIGIN = 'https://cyberjudah.io'
const PAGE = 20

type SearchKind = 'class' | 'captains' | 'history'
const KIND_OF_SERIES: Partial<Record<ClassCollection, SearchKind>> = {
  '15 Min w/ Captains': 'captains',
  'Our Hidden History': 'history',
}
const ALL_KINDS: SearchKind[] = ['class', 'captains', 'history']

type SiteHit = { kind?: string; url?: string; snippet?: string }

export type ClassSearchHit = { notesPath: string; snippet: string }

/** The kinds of notes a search covers: the chosen collection's, or all three. */
export const searchKindsFor = (series?: string): SearchKind[] =>
  !series ? ALL_KINDS : [KIND_OF_SERIES[series as ClassCollection] ?? 'class']

/** The classes whose notes say the words, best match first, with the passage that says them. */
export const searchInsideClasses = async (
  query: string,
  kinds: SearchKind[] = ALL_KINDS,
  fetcher: typeof fetch = fetch
): Promise<ClassSearchHit[]> => {
  const q = query.trim().slice(0, 200)
  if (q.length < 3) return []
  const pages = await Promise.all(
    kinds.map(async kind => {
      const response = await fetcher(
        `${SITE_ORIGIN}/search.json?q=${encodeURIComponent(q)}&only=${kind}&limit=${PAGE}`,
        { headers: { accept: 'application/json' } }
      )
      if (!response.ok) throw new Error(`CYBERJUDAH_CLASS_SEARCH_UNAVAILABLE:${response.status}`)
      const body = (await response.json()) as { ok?: boolean; hits?: SiteHit[] }
      if (body.ok === false) throw new Error('CYBERJUDAH_CLASS_SEARCH_UNAVAILABLE')
      return (body.hits ?? []).filter(hit => hit.kind === kind && typeof hit.url === 'string')
    })
  )
  // Each kind's best first, taking turns, so a search across all three shows some of each.
  const hits: ClassSearchHit[] = []
  for (let rank = 0; rank < PAGE; rank++)
    for (const page of pages) {
      const hit = page[rank]
      if (hit) hits.push({ notesPath: hit.url!, snippet: (hit.snippet ?? '').trim() })
    }
  return hits
}

/** The library's classes for the hits, in the hits' order, leaving out those already listed. */
export const classesForHits = (
  hits: ClassSearchHit[],
  classes: CyberJudahClass[],
  listed: ReadonlySet<string> = new Set()
) => {
  const byPath = new Map(classes.map(item => [item.notesPath, item]))
  const seen = new Set(listed)
  return hits.flatMap(hit => {
    const item = byPath.get(hit.notesPath)
    if (!item || seen.has(item.notesPath)) return []
    seen.add(item.notesPath)
    return [{ ...item, snippet: hit.snippet }]
  })
}

export type ClassSearchResult = CyberJudahClass & { snippet: string; start?: number }

/**
 * The classes for the Search tab: every class, Captains and Hidden History episode whose notes
 * say the words, best first, with the passage that says them.
 */
export const findClasses = async (
  query: string,
  loadLibrary: () => Promise<CyberJudahClass[]>,
  fetcher: typeof fetch = fetch
): Promise<ClassSearchResult[]> => {
  const [hits, classes] = await Promise.all([
    searchInsideClasses(query, ALL_KINDS, fetcher),
    loadLibrary(),
  ])
  return classesForHits(hits, classes)
}
