import type { Href } from 'expo-router'
import type { CyberJudahSource } from './cyberJudahAsk'
import { buildPublicDictionaryPath } from '~features/dictionnary/publicDictionaryRoutes'
import { buildPublicNavePath } from '~features/nave/publicNaveRoutes'

/** Only actual native study screens. Resource IDs come from retrieved sources, never AI URLs. */
export function studySourceRoute(source: CyberJudahSource): Href | undefined {
  let path: string
  try {
    const url = new URL(source.url, 'https://cyberjudah.io')
    if (url.origin !== 'https://cyberjudah.io') return
    path = url.pathname
  } catch {
    return
  }
  let match = /^\/person\/([a-z0-9-]+)$/.exec(path)
  if (match)
    return {
      pathname: '/strong/entity/[uniqueName]',
      params: { uniqueName: match[1], language: 'en' },
    }
  match = /^\/timeline\/event\/([a-z0-9-]+)$/.exec(path)
  if (match)
    return {
      pathname: '/(explore)/timeline/[language]/[slug]',
      params: { language: 'en', slug: match[1] },
    }
  match = /^\/strongs\/([HG]\d{1,5})$/i.exec(path)
  if (match)
    return { pathname: '/strong/[code]', params: { code: match[1].toUpperCase(), language: 'en' } }
  match = /^\/dictionary\/(en|fr)\/([a-z0-9-]+)\/([1-9]\d*)\/[a-z0-9-]+$/.exec(path)
  if (match)
    return buildPublicDictionaryPath({
      language: match[1] as 'en' | 'fr',
      work: match[2],
      entryId: Number(match[3]),
      word: source.title,
    }) as Href
  match = /^\/nave\/(en|fr)\/([^/]+)$/.exec(path)
  if (match) {
    try {
      return buildPublicNavePath({
        language: match[1] as 'en' | 'fr',
        topic: decodeURIComponent(match[2]),
      }) as Href
    } catch {
      return
    }
  }
  match = /^\/law\/([a-z0-9-]+)$/i.exec(path)
  if (match) return { pathname: '/(explore)/law-section', params: { id: match[1] } }
  if (/^\/glossary\/[a-z0-9-]+$/.test(path)) return '/(library)/glossary'
  return undefined
}

export const STUDY_DESTINATIONS = [
  'people',
  'encyclopedia',
  'dictionary',
  'nave',
  'timeline',
  'classes',
  'study-notes',
  'topics',
  'law',
  'precepts',
  'cases',
  'glossary',
  'doctrines',
  'strong',
  'reading-plans',
  'notes',
  'studies',
  'bookmarks',
  'highlights',
] as const
export type StudyDestination = (typeof STUDY_DESTINATIONS)[number]
export const studyDestinations: Partial<Record<StudyDestination, { route: Href; label: string }>> =
  {
    encyclopedia: { route: '/(library)/encyclopedia', label: 'Encyclopedia' },
    dictionary: { route: '/(library)/dictionnaire', label: 'Dictionary' },
    nave: { route: '/(library)/nave', label: 'Nave thematic Bible' },
    timeline: { route: '/(library)/timeline', label: 'Timeline' },
    classes: { route: '/(library)/passage-media', label: 'Classes' },
    'study-notes': { route: '/(library)/study-notes', label: 'Study notes' },
    topics: { route: '/(library)/topics', label: 'Topics' },
    law: { route: '/(library)/law', label: 'Handbook of the Law' },
    precepts: { route: '/(library)/precepts', label: 'Precepts' },
    cases: { route: '/(library)/case-studies', label: 'Case studies' },
    glossary: { route: '/(library)/glossary', label: 'Glossary' },
    doctrines: { route: '/(library)/false-doctrines', label: 'False doctrines' },
    strong: { route: '/(library)/lexique', label: 'Strong’s lexicon' },
    'reading-plans': { route: '/plans', label: 'Reading plans' },
    notes: { route: '/(library)/bible-verse-notes', label: 'My notes' },
    studies: { route: '/(library)/studies', label: 'My studies' },
    bookmarks: { route: '/(library)/bookmarks', label: 'Bookmarks' },
    highlights: { route: '/(library)/highlights', label: 'Highlights' },
  }
