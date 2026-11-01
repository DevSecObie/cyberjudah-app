import type { CyberJudahSource } from './cyberJudahAsk'

/** What kind of study card a source is, in the library's own words. */
const KINDS: Record<string, string> = {
  precept: 'Precept',
  case: 'Case study',
  law: 'Law',
  encyclopedia: 'Encyclopedia',
  topic: 'Topic',
  doctrine: 'Doctrine',
  study: 'Study notes',
  class: 'Class notes',
  captains: '15 Minutes with the Captains',
  history: 'Our Hidden History',
  book: 'Book',
  verse: 'Scripture',
  spoken: 'Class',
}
export const sourceKindLabel = (kind: string) => KINDS[kind] ?? kind

/** The precepts an answer cited, by their slug in the published data (/precepts/<slug>). */
export function citedPrecepts(sources: CyberJudahSource[]) {
  const seen = new Set<string>()
  const out: { n: number; slug: string; title: string }[] = []
  for (const source of sources) {
    const slug = /^(?:https:\/\/cyberjudah\.io)?\/precepts\/([a-z0-9-]+)\/?$/.exec(source.url)?.[1]
    if (!slug || seen.has(slug)) continue
    seen.add(slug)
    out.push({ n: source.n, slug, title: source.title })
    if (out.length === 3) break
  }
  return out
}
