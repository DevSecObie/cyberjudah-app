jest.mock('expo/virtual/env', () => ({ env: process.env }))
jest.mock('~i18n', () => ({ getLanguage: () => 'en', default: { t: (s: string) => s } }))
jest.mock('../../../i18n', () => ({ getLanguage: () => 'en' }))

const withProfile = (profile: string | undefined, run: () => void) => {
  const previous = process.env.EXPO_PUBLIC_RESOURCE_PROFILE
  if (profile === undefined) delete process.env.EXPO_PUBLIC_RESOURCE_PROFILE
  else process.env.EXPO_PUBLIC_RESOURCE_PROFILE = profile
  try {
    jest.isolateModules(run)
  } finally {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_RESOURCE_PROFILE
    else process.env.EXPO_PUBLIC_RESOURCE_PROFILE = previous
  }
}

describe('CyberJudah teaching passage links', () => {
  it.each([
    ['https://cyberjudah.io/bible/psalms/109#v1', 'Ps.109.1', 19],
    ['https://cyberjudah.io/bible/sirach/25#v24', 'Sir.25.24', 73],
    ['https://cyberjudah.io/bible/esther-greek/10#v4', 'GkEsth.10.4', 71],
    ['https://cyberjudah.io/bible/1-maccabees/2', '1Macc.2', 80],
    ['https://cyberjudah.io/bible/2-esdras/2?x=1#v18', '2Esd.2.18', 68],
  ])('opens %s in the reader as %s', (href, osis, book) => {
    withProfile('cyberjudah', () => {
      /* eslint-disable @typescript-eslint/no-require-imports */
      const { commentaryHrefToOsis } = require('~features/commentaries/commentaryResourceParams')
      const { osisToBibleReferenceTarget } = require('../bcvParser')
      /* eslint-enable @typescript-eslint/no-require-imports */
      expect(commentaryHrefToOsis(href)).toBe(osis)
      expect(osisToBibleReferenceTarget(osis, 'en')?.book).toBe(book)
    })
  })

  it.each([
    'https://cyberjudah.io/study/psalms/109',
    'https://cyberjudah.io/bible/esther-greek/3#v1',
    'https://cyberjudah.io/bible/psalms/151',
    'https://cyberjudah.io/bible/unknown-book/1',
    'https://cyberjudah.io.example.com/bible/psalms/1',
    'https://www.youtube.com/watch?v=abcdefghijk&t=10s',
  ])('keeps %s as an external link', href => {
    withProfile('cyberjudah', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { commentaryHrefToOsis } = require('~features/commentaries/commentaryResourceParams')
      expect(commentaryHrefToOsis(href)).toBeUndefined()
    })
  })

  it('does not reinterpret CyberJudah links in the upstream profile', () => {
    withProfile(undefined, () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { commentaryHrefToOsis } = require('~features/commentaries/commentaryResourceParams')
      expect(commentaryHrefToOsis('https://cyberjudah.io/bible/psalms/109#v1')).toBeUndefined()
      expect(commentaryHrefToOsis('bible://Matt.3.13-Matt.3.17')).toBe('Matt.3.13-Matt.3.17')
    })
  })
})
