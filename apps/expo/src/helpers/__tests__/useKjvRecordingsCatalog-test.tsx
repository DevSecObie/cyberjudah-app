import React from 'react'
import { act, create } from 'react-test-renderer'
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { getDefaultStore } from 'jotai'
import { kjvRecordingsCatalogAtom, useKjvRecordingsCatalog } from '../useKjvRecordingsCatalog'
import { getRecordingAudioUrl } from '../recordingsCatalog'

jest.mock('../editorialProfile', () => ({ usesCyberJudahEditorial: () => true }))
jest.mock('../storage', () => {
  const values = new Map<string, string>()
  return {
    storage: {
      getString: (key: string) => values.get(key),
      set: (key: string, value: string) => values.set(key, value),
      remove: (key: string) => values.delete(key),
    },
  }
})

const catalog = {
  chapters: [
    {
      slug: 'genesis',
      chapter: 1,
      audio: 'recordings/reader/genesis/1.m4a',
      sha256: 'c'.repeat(64),
    },
  ],
}
const Probe = () => {
  const data = useKjvRecordingsCatalog(true)
  return React.createElement('recording', { url: getRecordingAudioUrl(1, 1, data) })
}

beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})
afterEach(() => {
  getDefaultStore().set(kjvRecordingsCatalogAtom, null)
  onlineManager.setOnline(true)
  jest.restoreAllMocks()
})

it('reveals newly fetched recordings without remounting and persists the last successful catalog', async () => {
  const client = new QueryClient()
  let resolve!: (response: Response) => void
  jest.spyOn(globalThis, 'fetch').mockImplementation(
    () =>
      new Promise(r => {
        resolve = r
      }) as Promise<Response>
  )
  let renderer!: ReturnType<typeof create>
  await act(async () => {
    renderer = create(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>
    )
  })
  expect(renderer.root.find(node => String(node.type) === 'recording').props.url).toBe('')
  await act(async () => {
    resolve({ ok: true, json: async () => catalog } as Response)
    await new Promise(r => setTimeout(r, 30))
  })
  expect(renderer.root.find(node => String(node.type) === 'recording').props.url).toContain(
    '?v=' + 'c'.repeat(64)
  )
  expect(getDefaultStore().get(kjvRecordingsCatalogAtom)?.catalog).toEqual(catalog)
  await act(async () => {
    renderer.unmount()
  })
  client.clear()
})

it('uses a persisted catalog offline and preserves it after a failed refresh', async () => {
  getDefaultStore().set(kjvRecordingsCatalogAtom, { fetchedAt: Date.now() - 600_000, catalog })
  onlineManager.setOnline(false)
  const fetcher = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
  const client = new QueryClient()
  let renderer!: ReturnType<typeof create>
  await act(async () => {
    renderer = create(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>
    )
  })
  expect(fetcher).not.toHaveBeenCalled()
  expect(renderer.root.find(node => String(node.type) === 'recording').props.url).toContain(
    '?v=' + 'c'.repeat(64)
  )
  await act(async () => {
    onlineManager.setOnline(true)
    await client.refetchQueries()
    await new Promise(r => setTimeout(r, 30))
  })
  expect(fetcher).toHaveBeenCalled()
  expect(getDefaultStore().get(kjvRecordingsCatalogAtom)?.catalog).toEqual(catalog)
  expect(renderer.root.find(node => String(node.type) === 'recording').props.url).toContain(
    '?v=' + 'c'.repeat(64)
  )
  await act(async () => {
    renderer.unmount()
  })
  client.clear()
})
