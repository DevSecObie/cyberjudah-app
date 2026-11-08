// Existing commentary unit tests exercise upstream algorithms with historical fixture metadata.
// Production catalog filtering is checked directly by the resource-catalog node tests.
const actual = jest.requireActual(require('node:path').resolve(__dirname, '../../../packages/resource-catalog/src/commentaryCatalog'))
const catalog = actual.BASE_COMMENTARY_CATALOG
module.exports = {
  ...actual,
  COMMENTARY_CATALOG: catalog,
  COMMENTARY_CATALOG_BY_ID: new Map(catalog.map(entry => [entry.id, entry])),
  getCommentaryCatalogForLanguage: language =>
    catalog.filter(entry => entry.languages.includes(language)),
  getCommentaryByPublicationId: (publicationId, language) =>
    catalog.find(entry => entry.publicationId === publicationId && entry.languages.includes(language)),
}
