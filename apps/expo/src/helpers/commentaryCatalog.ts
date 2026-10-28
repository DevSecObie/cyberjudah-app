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
    ? [
        {
          id: 'cyberjudah',
          publicationId: 'cyberjudah',
          shortName: 'CyberJudah',
          title: 'CyberJudah teachings',
          description: { en: 'Published CyberJudah classes and Scripture references.' },
          author: 'CyberJudah',
          languages: ['en'],
          tradition: 'CyberJudah',
          tags: [],
          rights: 'See the original teaching linked in each entry.',
        },
      ]
    : upstreamCatalog
export const COMMENTARY_CATALOG_BY_ID = new Map(COMMENTARY_CATALOG.map(entry => [entry.id, entry]))
export const getCommentaryCatalogForLanguage = (language: CommentaryLanguage) =>
  COMMENTARY_CATALOG.filter(entry => entry.languages.includes(language))
export const getCommentaryByPublicationId = (publicationId: string, language: CommentaryLanguage) =>
  COMMENTARY_CATALOG.find(
    entry => entry.publicationId === publicationId && entry.languages.includes(language)
  )
