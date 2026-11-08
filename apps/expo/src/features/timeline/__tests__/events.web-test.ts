import { getEvents } from '../events.web'
import sections from '~assets/cyberjudah/timeline-sections.json'

describe('owned timeline geometry', () => {
  it('uses the supplied geometry without fetching the upstream timeline asset', async () => {
    const fetcher = jest.spyOn(globalThis, 'fetch')
    await expect(getEvents()).resolves.toEqual(sections)
    expect(fetcher).not.toHaveBeenCalled()
    fetcher.mockRestore()
  })
})
