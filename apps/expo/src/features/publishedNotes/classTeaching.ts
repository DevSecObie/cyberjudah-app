// Topics, false doctrines and the glossary: the Telegram app's sections built from the classes,
// read from CyberJudah's published data set (data.cyberjudah.io) so they update without an app
// update. Shapes follow cyberjudah-telegram app/src/api/data.ts.
const DATA_ORIGIN = 'https://data.cyberjudah.io'

const SLUG = /^[a-z0-9][a-z0-9-]*$/i

const readJson = async <T>(path: string, fetcher: typeof fetch = fetch): Promise<T> => {
  const response = await fetcher(`${DATA_ORIGIN}${path}`, {
    headers: { accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`CYBERJUDAH_DATA_UNAVAILABLE:${response.status}`)
  return response.json() as Promise<T>
}

export type VerseText = { verse: number; text: string }
export type ScriptureRef = { label: string; url: string; text?: VerseText[] }
export type Moment = {
  video: string
  ts: string
  t: number
  teacher?: string
  title?: string
  date?: string
  text?: string
  note?: string
  read?: boolean
}

export type TopicRow = { slug: string; label: string; notes: number; cases: number; url: string }
export type TopicItem = {
  kind: string
  title: string
  url: string
  date?: string
  teacher?: string
  verdict?: string
  charge?: string
}
export type ThreadStop = {
  label: string
  url: string
  text: string
  classes: {
    title: string
    url: string
    ts?: string
    t?: number
    date?: string
    teacher?: string
  }[]
  precepts: { label: string; url: string }[]
}
export type Topic = { slug: string; label: string; items: TopicItem[]; thread?: ThreadStop[] }

export type DoctrineRow = { slug: string; name: string; claim: string }
export type DoctrineEntry = {
  slug: string
  name: string
  claim: string
  url: string
  answers: { refs: ScriptureRef[]; sense: Moment[] }[]
  scriptures?: (ScriptureRef & { points: Moment[] })[]
  books?: {
    title: string
    author?: string
    year?: number | null
    url?: string
    pages?: { vol: number; page: number; classes: number; quotes?: { text: string }[] }[]
    said?: { ref: { label: string; url?: string }; text: string } & Moment
  }[]
  related: Record<
    'precepts' | 'cases' | 'topics',
    { slug: string; url: string; title?: string; name?: string; label?: string }[]
  >
}

export type GlossaryEntry = {
  term: string
  slug: string
  aliases: string[]
  definition: string
  scripture: { label: string; url: string }[]
  see: { title: string; url: string }[]
  taught: { title: string; video: string; seconds: number }[]
}

/** The topics Telegram lists: those with notes or cases, without the verdict groupings. */
export const loadTopics = async (fetcher?: typeof fetch) =>
  (await readJson<TopicRow[]>('/api/topics/index.json', fetcher)).filter(
    row => SLUG.test(row.slug) && (row.notes || row.cases) && !row.slug.startsWith('verdict-')
  )

export const loadTopic = (slug: string, fetcher?: typeof fetch) => {
  if (!SLUG.test(slug)) throw new Error('CYBERJUDAH_TOPIC_INVALID')
  return readJson<Topic>(`/api/topics/${slug}.json`, fetcher)
}

/** The false doctrines, A to Z. */
export const loadDoctrines = async (fetcher?: typeof fetch) =>
  (await readJson<DoctrineRow[]>('/api/doctrine/index.json', fetcher))
    .filter(row => SLUG.test(row.slug))
    .sort((a, b) => a.name.localeCompare(b.name))

export const loadDoctrine = (slug: string, fetcher?: typeof fetch) => {
  if (!SLUG.test(slug)) throw new Error('CYBERJUDAH_DOCTRINE_INVALID')
  return readJson<DoctrineEntry>(`/api/doctrine/${slug}.json`, fetcher)
}

export const loadGlossary = (fetcher?: typeof fetch) =>
  readJson<{ about?: string; entries: GlossaryEntry[] }>('/api/glossary/index.json', fetcher)

/** The glossary's words a search leaves, a section per letter, A to Z. */
export const glossarySections = (entries: GlossaryEntry[] | undefined, query = '') => {
  const q = query.trim().toLowerCase()
  const hits = (entries ?? []).filter(
    e =>
      !q ||
      e.term.toLowerCase().includes(q) ||
      e.aliases.some(a => a.toLowerCase().includes(q)) ||
      e.definition.toLowerCase().includes(q)
  )
  const letters = new Map<string, GlossaryEntry[]>()
  for (const e of [...hits].sort((a, b) => a.term.localeCompare(b.term))) {
    const letter = /[a-z]/i.test(e.term[0]) ? e.term[0].toUpperCase() : '#'
    letters.set(letter, [...(letters.get(letter) ?? []), e])
  }
  return [...letters.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([title, data]) => ({ title, data }))
}

/** A scripture's verses as one passage. */
export const verseText = (ref: Pick<ScriptureRef, 'text'>) =>
  (ref.text ?? []).map(v => v.text).join(' ')
