import {
  COMMENTARY_CATALOG as upstreamCatalog,
  type CommentaryCatalogEntry,
  type CommentaryLanguage,
} from '@bible-strong/resource-catalog/commentaries'
export type {
  CommentaryCatalogEntry,
  CommentaryLanguage,
} from '@bible-strong/resource-catalog/commentaries'
export const COMMENTARY_CATALOG: readonly CommentaryCatalogEntry[] =
  process.env.EXPO_PUBLIC_RESOURCE_PROFILE === 'cyberjudah'
    ? // One commentary per Bishop, each holding only his own teaching from the classes (Obie,
      // 2026-10-31). Other teachers follow once the Bishops' commentaries are complete.
      (['Bishop Nathanyel', 'Bishop Yawasap', 'Bishop Kani'] as const).map(name => {
        const id = name.toLowerCase().replace(' ', '-')
        return {
          id,
          publicationId: id,
          shortName: name,
          title: name,
          description: {
            en: `${name}'s precepts and verse breakdowns from the classes, in the classes' own words.`,
          },
          author: name,
          languages: ['en'],
          tradition: 'Israel United in Christ',
          tags: [],
          rights: 'See the original class linked in each entry.',
        } satisfies CommentaryCatalogEntry
      })
    : upstreamCatalog
export const COMMENTARY_CATALOG_BY_ID = new Map(COMMENTARY_CATALOG.map(entry => [entry.id, entry]))
export const getCommentaryCatalogForLanguage = (language: CommentaryLanguage) =>
  COMMENTARY_CATALOG.filter(entry => entry.languages.includes(language))
export const getCommentaryByPublicationId = (publicationId: string, language: CommentaryLanguage) =>
  COMMENTARY_CATALOG.find(
    entry => entry.publicationId === publicationId && entry.languages.includes(language)
  )
