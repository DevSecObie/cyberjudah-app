// CyberJudah's case studies, from the published data the Telegram app reads: the judgments
// recorded in scripture, and those who kept the law and were blessed.
const DATA_ORIGIN = 'https://data.cyberjudah.io'

export type CaseRow = {
  slug: string
  name: string
  era: string
  kind: 'judgment' | 'blessing'
  charge: string
  verdict: string
  url: string
  code?: string
  topics?: string[]
}
export type CaseIndex = { eras: string[]; verdicts: Record<string, string>; cases: CaseRow[] }
export type CaseVerse = { verse: number; text: string }
export type CaseScripture = { label: string; url: string; slug: string; text: CaseVerse[] }
export type CaseStudy = CaseRow & {
  summary?: string
  offense?: string
  judgment?: string
  offenseFull?: string[]
  judgmentFull?: string[]
  verdictLabel?: string
  refsResolved?: CaseScripture[]
  lawsResolved?: { id: string; text: string; url: string | null }[]
  preceptsResolved?: { slug: string; title: string; url: string | null }[]
  related?: { slug: string; name: string; charge: string; url: string | null; desc?: string }[]
  taught?: { title: string; range: string; url: string }[]
  see?: { title: string; url: string }[]
  people?: { id: string; name: string }[]
}

const read = async <T>(path: string, fetcher: typeof fetch): Promise<T> => {
  const response = await fetcher(`${DATA_ORIGIN}${path}`, {
    headers: { accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`CYBERJUDAH_CASES_UNAVAILABLE:${response.status}`)
  return (await response.json()) as T
}

export const loadCaseIndex = (fetcher: typeof fetch = fetch) =>
  read<CaseIndex>('/api/cases/index.json', fetcher)

export const loadCaseStudy = (slug: string, fetcher: typeof fetch = fetch) => {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('CYBERJUDAH_CASE_SLUG_INVALID')
  return read<CaseStudy>(`/api/cases/${slug}.json`, fetcher)
}

export const kindName = (kind: string) => (kind === 'blessing' ? 'Blessing' : 'Judgment')

/** The cases a search and the filters leave, filed under their eras in order. */
export const caseSections = (
  index: CaseIndex | undefined,
  { query = '', kind, era }: { query?: string; kind?: string; era?: string }
) => {
  const needle = query.trim().toLowerCase()
  const rows = (index?.cases ?? []).filter(
    row =>
      (!kind || row.kind === kind) &&
      (!era || row.era === era) &&
      (!needle ||
        `${row.name} ${row.charge} ${row.verdict} ${row.code ?? ''}`.toLowerCase().includes(needle))
  )
  return (index?.eras ?? [])
    .map(title => ({ title, data: rows.filter(row => row.era === title) }))
    .filter(section => section.data.length)
}

/** A case's slug from its site address ("/cases/01-primeval/adam-and-eve"). */
export const caseSlugOf = (url: string) => /^\/cases\/[^/]+\/([a-z0-9-]+)$/.exec(url)?.[1]
