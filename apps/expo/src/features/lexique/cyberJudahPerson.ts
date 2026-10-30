// A person's page from CyberJudah's published People data, the one the Telegram app shows: their
// family with the verses that state it, what the classes taught on them, the classes that read of
// them and the related case studies.
const DATA_ORIGIN = 'https://data.cyberjudah.io'

export type PersonLink = { id: string; name: string; verses?: string[]; note?: string }
export type PersonTeaching = {
  verse: string
  url: string
  points: string[]
  note: { label: string; url: string; date: string; teacher: string }
  ts?: string
  video?: string
  t?: number
}
export type PersonClass = {
  title: string
  url: string
  kind: string
  collection: string
  date: string | null
  verse: string
  verseUrl: string
}
export type PersonCase = {
  slug: string
  name: string
  url: string
  era: string
  kind: string
  verdictLabel: string
}
export type CyberJudahPerson = {
  id: string
  name: string
  taught: PersonTeaching[]
  classes: PersonClass[]
  cases: PersonCase[]
} & Partial<Record<(typeof KNOWN)[number][0], PersonLink[]>>

/** The family and kinship the page explains, in the Telegram app's order and words. */
export const KNOWN = [
  ['father', 'Father'],
  ['mother', 'Mother'],
  ['partners', 'Husband or wife'],
  ['siblings', 'Brother or sister'],
  ['children', 'Child'],
  ['line', 'Forefather'],
  ['descendants', 'Descendant'],
  ['tribes', 'Tribe'],
  ['nation', 'People'],
  ['same', 'Same person as'],
  ['alsoNamed', 'Same person as'],
] as const

/** Each stated link with the verses behind it; how sure the link is is not shown. */
export const howWeKnow = (person: CyberJudahPerson) =>
  KNOWN.flatMap(([key, label]) =>
    (person[key] ?? []).filter(link => link?.id && link.name).map(link => ({ label, link }))
  )

// The Bishops' and Deacons' teaching comes first, then the newest.
const teacherRank = (teacher = '') =>
  /^bishop/i.test(teacher) ? 0 : /^deacon/i.test(teacher) ? 1 : 2
export const orderTeachings = (taught: PersonTeaching[]) =>
  [...taught].sort(
    (a, b) =>
      teacherRank(a.note?.teacher) - teacherRank(b.note?.teacher) ||
      (b.note?.date ?? '').localeCompare(a.note?.date ?? '')
  )

const fold = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
/** A class's points on a verse, leaving out one that only repeats the verse. */
export const ownPoints = (points: string[], verseText: string) => {
  const verse = fold(verseText)
  return points.filter(point => {
    const folded = fold(point)
    return folded && !(verse && (folded === verse || verse.includes(folded)))
  })
}

/** "genesis/4/1" or "/bible/genesis/4#v1" as the site's address for its verse. */
export const verseSiteUrl = (path: string) => {
  const site = /^\/bible\/([a-z0-9-]+)\/(\d+)(?:#v(\d+(?:-\d+)?))?$/.exec(path)
  if (site)
    return `https://cyberjudah.io/bible/${site[1]}/${site[2]}${site[3] ? `#v${site[3].split('-')[0]}` : ''}`
  const [slug, chapter, verse] = path.split('/')
  return `https://cyberjudah.io/bible/${slug}/${chapter}${verse ? `#v${verse}` : ''}`
}

export const loadCyberJudahPerson = async (
  id: string,
  fetcher: typeof fetch = fetch
): Promise<CyberJudahPerson> => {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error('CYBERJUDAH_PERSON_ID_INVALID')
  const response = await fetcher(`${DATA_ORIGIN}/api/people/${id}.json`, {
    headers: { accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`CYBERJUDAH_PERSON_UNAVAILABLE:${response.status}`)
  const person = (await response.json()) as CyberJudahPerson
  return {
    ...person,
    taught: person.taught ?? [],
    classes: person.classes ?? [],
    cases: person.cases ?? [],
  }
}

type Chapter = { verses?: { verse: number; text: string }[] }
/** The KJV text of "/bible/slug/chapter#vN" (or a range "#vN-M"), from the published chapter. */
export const loadVerseText = async (url: string, fetcher: typeof fetch = fetch) => {
  const match = /^\/bible\/([a-z0-9-]+)\/(\d+)(?:#v(\d+)(?:-(\d+))?)?$/.exec(url)
  if (!match) return ''
  const response = await fetcher(`${DATA_ORIGIN}/api/kjv/${match[1]}/${match[2]}.json`)
  if (!response.ok) return ''
  const chapter = (await response.json()) as Chapter
  const from = Number(match[3] ?? 1)
  const to = Number(match[4] ?? match[3] ?? 1)
  return (chapter.verses ?? [])
    .filter(verse => verse.verse >= from && verse.verse <= to)
    .map(verse => verse.text)
    .join(' ')
}
