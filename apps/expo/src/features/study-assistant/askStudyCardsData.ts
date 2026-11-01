import type { PassageTarget } from '@bible-strong/ai-contract/contract'
import { parseBibleReferenceSegments, type BcvLanguage } from '~helpers/bcvParser'
import type { CyberJudahSource } from './cyberJudahAsk'

export type AskStudyCardsData = { sources: CyberJudahSource[]; passages: PassageTarget[] }

/** The existing Ask service returns prose and citations. Adapt that response to OpenUI
 * without executing model-authored UI, URLs or queries. Scripture comes from ResourceAccess. */
export function askStudyCardsData(
  question: string,
  answer: string,
  sources: CyberJudahSource[],
  version: string,
  language: BcvLanguage
): AskStudyCardsData {
  const passages: PassageTarget[] = []
  const seen = new Set<string>()
  // Question references come first so a requested comparison keeps the requested order.
  for (const text of [question.slice(0, 4000), answer.slice(0, 60000)]) {
    const clean = text
      .replace(/```[\s\S]*?(?:```|$)/g, '')
      .replace(/`[^`]*`/g, '')
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/https?:\/\/\S+/g, '')
    // CyberJudah answers may be English even with the interface set to French.
    for (const locale of language === 'fr' ? (['fr', 'en'] as const) : (['en'] as const)) {
      for (const segment of parseBibleReferenceSegments(clean, locale)) {
        // Whole chapters and large ranges remain in the answer, not a huge inline card.
        if (segment.isWholeChapter || segment.endVerse - segment.startVerse >= 8) continue
        const key = `${segment.book}:${segment.chapter}:${segment.startVerse}:${segment.endVerse}`
        if (seen.has(key)) continue
        seen.add(key)
        passages.push({
          version,
          book: segment.book,
          chapter: segment.chapter,
          start: segment.startVerse,
          end: segment.endVerse,
        })
        if (passages.length === 4) return { sources: sources.slice(0, 12), passages }
      }
    }
  }
  return { sources: sources.slice(0, 12), passages }
}

/** Only bounded integer references enter the OpenUI language. Source text, thumbnails,
 * scripture and links stay in trusted native components, outside the generated program. */
export function askStudyCardsProgram(data: AskStudyCardsData): string {
  const children: string[] = []
  if (data.sources.length) {
    children.push(`SourceCards(${JSON.stringify(data.sources.slice(0, 12).map((_, i) => i))})`)
  }
  if (data.passages.length) {
    children.push(`VerseComparison(${JSON.stringify(data.passages.slice(0, 4).map((_, i) => i))})`)
  }
  return `root = StudyAnswer([${children.join(', ')}])`
}

export function selectStudyItems<T>(items: T[], indices: number[], limit: number): T[] {
  return [...new Set(indices)]
    .filter(i => Number.isInteger(i) && i >= 0 && i < items.length)
    .slice(0, limit)
    .map(i => items[i])
}
