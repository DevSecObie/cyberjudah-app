// These reader/transport algorithms retain the complete upstream fixture.
jest.mock('@bible-strong/resource-catalog/catalog', () =>
  require('../../../../test/jestUpstreamPackageCatalogFixture')
)
jest.mock('~helpers/strongBibleCatalog', () =>
  require('../../../../test/jestUpstreamStrongCatalogFixture')
)
jest.mock('~assets/cyberjudah/excluded-upstream-resources.json', () => [])
/* eslint-disable import/first */

jest.mock('~helpers/firebase', () => ({
  cdnUrl: (path: string) => `https://cdn.test/${path}`,
  firebaseStorage: {},
}))

import { loadStrongModeAvailability } from '../loadStrongModeAvailability'

describe('Strong mode availability', () => {
  it('rejects the whole availability read when one required interlinear locale fails', async () => {
    const getStrongAvailability = jest.fn().mockResolvedValue({ status: 'available' })
    const getInterlinearAvailability = jest
      .fn()
      .mockResolvedValueOnce({ status: 'available' })
      .mockRejectedValueOnce(new Error('temporary failure'))

    await expect(
      loadStrongModeAvailability({
        appLanguage: 'fr',
        getInterlinearAvailability,
        getStrongAvailability,
        version: 'LSG',
      })
    ).rejects.toThrow('temporary failure')
  })

  it('returns a complete snapshot when every availability read succeeds', async () => {
    const getStrongAvailability = jest.fn().mockResolvedValue({ status: 'available' })
    const getInterlinearAvailability = jest.fn().mockResolvedValue({ status: 'available' })

    await expect(
      loadStrongModeAvailability({
        appLanguage: 'fr',
        getInterlinearAvailability,
        getStrongAvailability,
        version: 'LSG',
      })
    ).resolves.toMatchObject({
      strong: { status: 'available' },
      interlinear: [
        { locale: 'fr', availability: { status: 'available' } },
        { locale: 'en', availability: { status: 'available' } },
      ],
    })
  })
})
