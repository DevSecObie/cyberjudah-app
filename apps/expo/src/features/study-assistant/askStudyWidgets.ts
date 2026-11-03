import { parseStudyWidget, type StudyWidget } from '@bible-strong/ai-contract/contract'
import type { CyberJudahSource } from './cyberJudahAsk'

const MAX_CARDS = 3

/** The source numbers an answer cites: its [n] markers and its Sources([..]) list. */
export function citedNumbers(text: string): Set<number> {
  const out = new Set<number>()
  for (const m of text.matchAll(/\[(\d{1,2})\]/g)) out.add(Number(m[1]))
  for (const m of text.matchAll(/Sources\(\[([\d,\s]+)\]\)/g))
    for (const n of m[1].split(',')) if (n.trim()) out.add(Number(n))
  return out
}

/** Bible Strong's own assistant card for one source, built only from the source's own
 * address or id, never from model text. Commentary side by side is left out (owner's call). */
function widgetOf(source: CyberJudahSource, slot: number): StudyWidget | undefined {
  const id = `w${slot}`
  let path = ''
  try {
    const url = new URL(source.url, 'https://cyberjudah.io')
    if (url.origin === 'https://cyberjudah.io') path = url.pathname
  } catch {
    return
  }
  const title = source.title.slice(0, 120)
  const person = /^\/person\/([a-z0-9-]+)$/.exec(path)?.[1]
  if (person) return { id, kind: 'person_profile', title, entityKey: person, language: 'en' }
  if (source.kind === 'place' && source.entity)
    return { id, kind: 'place_profile', title, entityKey: source.entity, language: 'en' }
  const code = /^\/strongs\/([HG]\d{1,5})$/i.exec(path)?.[1]?.toUpperCase()
  if (code)
    return {
      id,
      kind: 'strong_entry',
      title,
      reference: code,
      identityKind: 'strong',
      language: 'en',
      scope: 'precise_identity',
    }
  const event = /^\/timeline\/event\/([a-z0-9-]+)$/.exec(path)?.[1]
  if (event) return { id, kind: 'event_timeline', title, events: [event], language: 'en' }
  const nave = /^\/nave\/en\/([^/]+)$/.exec(path)?.[1]
  if (nave) {
    try {
      return { id, kind: 'nave_topic', title, topic: decodeURIComponent(nave), language: 'en' }
    } catch {
      return
    }
  }
  return undefined
}

/** Up to three cards for the sources an answer cites, in citation order, each checked by the
 * same contract parser Bible Strong's assistant uses. */
export function askStudyWidgets(sources: CyberJudahSource[], cited: Set<number>): StudyWidget[] {
  const out: StudyWidget[] = []
  const seen = new Set<string>()
  for (const source of sources) {
    if (!cited.has(source.n) || out.length >= MAX_CARDS) continue
    const widget = widgetOf(source, out.length + 1)
    if (!widget) continue
    const key = JSON.stringify({ ...widget, id: '', title: '' })
    if (seen.has(key)) continue
    try {
      out.push(parseStudyWidget(widget))
      seen.add(key)
    } catch {
      // A source the contract refuses simply stays a source card.
    }
  }
  return out
}
