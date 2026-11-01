import { buildPublicCommentaryPath, parsePublicCommentaryRoute } from '../publicCommentaryRoutes'

describe('public commentary routes', () => {
  it('builds a chapter and compact deterministic section path', () => {
    expect(
      buildPublicCommentaryPath({ resourceId: 'barnes', language: 'fr', book: 43, chapter: 3 })
    ).toBe('/commentary/fr/barnes/john/3')
    expect(
      buildPublicCommentaryPath({
        resourceId: 'barnes',
        language: 'fr',
        book: 43,
        chapter: 3,
        sectionId: 'barnes-fr-43-3-16-18',
      })
    ).toBe('/commentary/fr/barnes/john/3/16-18')
  })

  it('restores the full section identity from the public route', () => {
    expect(
      parsePublicCommentaryRoute({
        language: 'fr',
        resource: 'barnes',
        book: 'john',
        chapter: '3',
        section: '16-18',
      })
    ).toEqual({
      resourceId: 'barnes',
      language: 'fr',
      book: 43,
      chapter: 3,
      sectionId: 'barnes-fr-43-3-16-18',
    })
  })

  it('rejects unsupported projections and book identities', () => {
    expect(
      parsePublicCommentaryRoute({
        language: 'fr',
        resource: 'unknown',
        book: 'john',
        chapter: '3',
      })
    ).toBeUndefined()
    expect(
      parsePublicCommentaryRoute({
        language: 'fr',
        resource: 'barnes',
        book: 'unknown',
        chapter: '3',
      })
    ).toBeUndefined()
  })
})

describe('CyberJudah commentary canon', () => {
  it('round-trips routes for the final Apocrypha books', () => {
    const previousProfile = process.env.EXPO_PUBLIC_RESOURCE_PROFILE
    process.env.EXPO_PUBLIC_RESOURCE_PROFILE = 'cyberjudah'
    try {
      jest.isolateModules(() => {
        const routes =
          require('../publicCommentaryRoutes') as typeof import('../publicCommentaryRoutes')
        for (const book of [80, 81]) {
          const route = { resourceId: 'bishop-kani', language: 'en' as const, book, chapter: 1 }
          const path = routes.buildPublicCommentaryPath(route)
          const [, , language, resource, osis, chapter] = path.split('/')
          expect(
            routes.parsePublicCommentaryRoute({ language, resource, book: osis, chapter })
          ).toEqual(route)
        }
      })
    } finally {
      if (previousProfile === undefined) delete process.env.EXPO_PUBLIC_RESOURCE_PROFILE
      else process.env.EXPO_PUBLIC_RESOURCE_PROFILE = previousProfile
    }
  })
})
