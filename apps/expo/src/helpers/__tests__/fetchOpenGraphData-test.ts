let mockCyberJudah = true
const mockUser = { getIdToken: jest.fn(async () => 'token') }
jest.mock('~helpers/editorialProfile', () => ({ usesCyberJudahEditorial: () => mockCyberJudah }))
jest.mock('../firebaseAuthRuntime', () => ({ getCurrentAuthUser: () => mockUser }))
jest.mock('~redux/modules/user', () => ({}))

import { fetchOpenGraphData } from '../fetchOpenGraphData'

const ok = (data: object) =>
  jest.fn(async () => ({ ok: true, json: async () => ({ data }) }) as unknown as Response)

it("reads CyberJudah's previews from its own server, signed in", async () => {
  mockCyberJudah = true
  const fetcher = ok({ title: 'A page' })
  const data = await fetchOpenGraphData('https://example.com/a?b=1', fetcher)
  expect(data).toMatchObject({ title: 'A page' })
  const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
  expect(url).toMatch(/\/api\/og\?url=https%3A%2F%2Fexample\.com%2Fa%3Fb%3D1$/)
  expect(url).not.toContain('cloudfunctions.net')
  expect(init.headers).toEqual({ Authorization: 'Bearer token' })
})

it("keeps Bible Strong's own build on its cloud function", async () => {
  mockCyberJudah = false
  const fetcher = ok({ title: 'A page' })
  await fetchOpenGraphData('https://example.com', fetcher)
  expect((fetcher.mock.calls[0] as unknown as [string])[0]).toContain(
    'cloudfunctions.net/fetchOpenGraph'
  )
})

it('gives no preview for a bad address or a failed request', async () => {
  mockCyberJudah = true
  const fetcher = jest.fn(async () => ({ ok: false }) as Response)
  expect(await fetchOpenGraphData('not a url', fetcher)).toBeNull()
  expect(fetcher).not.toHaveBeenCalled()
  expect(await fetchOpenGraphData('https://example.com', fetcher)).toBeNull()
})
