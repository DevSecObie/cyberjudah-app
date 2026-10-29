jest.mock('~helpers/bibleVersions', () => ({ versions: { KJV: { id: 'KJV' } } }))

describe('CyberJudah public Bible routes', () => {
  const profile = process.env.EXPO_PUBLIC_RESOURCE_PROFILE
  afterEach(() => {
    process.env.EXPO_PUBLIC_RESOURCE_PROFILE = profile
    jest.resetModules()
  })

  it('loads with the Apocrypha in the KJV 1611 order and finds its books by name', () => {
    process.env.EXPO_PUBLIC_RESOURCE_PROFILE = 'cyberjudah'
    jest.resetModules()
    const routes = require('../publicBibleRoutes') as typeof import('../publicBibleRoutes')
    expect(routes.parsePublicBibleRoute(['kjv', '1-esdras', '1'])?.book.Numero).toBe(67)
    expect(routes.parsePublicBibleRoute(['kjv', 'baruch', '1'])?.book.Numero).toBe(74)
  })
})
