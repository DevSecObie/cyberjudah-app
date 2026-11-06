describe('CyberJudah native sharing', () => {
  const profile = process.env.EXPO_PUBLIC_RESOURCE_PROFILE
  const origin = process.env.EXPO_PUBLIC_CYBERJUDAH_WEB_URL

  afterEach(() => {
    if (profile === undefined) delete process.env.EXPO_PUBLIC_RESOURCE_PROFILE
    else process.env.EXPO_PUBLIC_RESOURCE_PROFILE = profile
    if (origin === undefined) delete process.env.EXPO_PUBLIC_CYBERJUDAH_WEB_URL
    else process.env.EXPO_PUBLIC_CYBERJUDAH_WEB_URL = origin
  })

  it.each(['https://web.cyberjudah.io', 'https://cyberjudah-telegram-staging.oisrae1.workers.dev'])(
    'sends native shares to the app routes on %s',
    base => {
      process.env.EXPO_PUBLIC_RESOURCE_PROFILE = 'cyberjudah'
      process.env.EXPO_PUBLIC_CYBERJUDAH_WEB_URL = base + '/'
      jest.isolateModules(() => {
        const links: typeof import('../publicSiteLinks') = require('../publicSiteLinks')
        expect(links.getVersesShareUrl(['58-7-15'], 'KJV')).toBe(base + '/bible/kjv/heb/7/15')
        expect(links.getChapterShareUrl(1, 1, 'LSG')).toBeUndefined()
        expect(links.getStrongShareUrl('G26', 'greek', 'en')).toBe(base + '/strong/g0026')
        expect(links.getPublicSiteUrl(() => '/nave/en/faith')).toBe(base + '/nave/en/faith')
      })
    }
  )
})
