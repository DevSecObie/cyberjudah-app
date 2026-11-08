import type {
  SearchAnalyticsEventName,
  SearchAnalyticsInputKind,
  SearchAnalyticsMatchKind,
  SearchAnalyticsOrigin,
  SearchAnalyticsOutcome,
  SearchAnalyticsResultType,
  SearchAnalyticsSource,
} from './searchAnalyticsContract'

export type SearchAnalyticsEvent = {
  event: SearchAnalyticsEventName
  query: string
  language: 'fr' | 'en'
  origin: SearchAnalyticsOrigin
  inputKind: SearchAnalyticsInputKind
  sources: SearchAnalyticsSource[]
  versionIds: string[]
  outcome: SearchAnalyticsOutcome
  resultCounts: {
    total: number
    references: number
    passages: number
    strong: number
    dictionary: number
    nave: number
  }
  matchKind: SearchAnalyticsMatchKind
  topicId?: string
  durationMs?: number
  clickedResultType?: SearchAnalyticsResultType
  clickedResultKey?: string
  clickedRank?: number
}

export type SearchAnalyticsAccess = {
  record: (event: SearchAnalyticsEvent) => Promise<void>
}

export const noOpSearchAnalyticsAccess: SearchAnalyticsAccess = {
  record: async () => undefined,
}

export const createHttpSearchAnalyticsAccess = (_options: {
  baseUrl: string
  fetcher?: typeof fetch
  isOnline: () => Promise<boolean>
  timeoutMs?: number
}): SearchAnalyticsAccess => noOpSearchAnalyticsAccess
