import { createHttpSearchAnalyticsAccess } from '../searchAnalyticsAccess'

const event = {
  event: 'search_performed' as const,
  query: 'anxiété',
  language: 'fr' as const,
  origin: 'typed' as const,
  inputKind: 'keyword' as const,
  sources: ['passages'] as const,
  versionIds: ['LSG'],
  outcome: 'success' as const,
  resultCounts: {
    total: 12,
    references: 0,
    passages: 12,
    strong: 0,
    dictionary: 0,
    nave: 0,
  },
  matchKind: 'semantic' as const,
}

describe('search analytics HTTP access', () => {
  it('does not transmit queries or tapped results, even while online', async () => {
    const fetcher = jest.fn(async () => new Response('{}', { status: 202 }))
    const access = createHttpSearchAnalyticsAccess({
      baseUrl: 'https://api.cyberjudah.io/',
      fetcher,
      isOnline: async () => true,
    })

    await access.record({ ...event, sources: [...event.sources] })

    await access.record({
      ...event,
      event: 'result_opened',
      sources: [...event.sources],
      clickedResultType: 'passage',
      clickedResultKey: '1-1-1',
      clickedRank: 1,
    })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('does not queue an event while offline', async () => {
    const fetcher = jest.fn()
    const access = createHttpSearchAnalyticsAccess({
      baseUrl: 'https://api.cyberjudah.io',
      fetcher,
      isOnline: async () => false,
    })

    await access.record({ ...event, sources: [...event.sources] })

    expect(fetcher).not.toHaveBeenCalled()
  })
})
