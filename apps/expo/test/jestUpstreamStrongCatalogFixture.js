/* global jest */
// Historical dataset identities used by upstream transport/selection fixtures.
const actual = jest.requireActual('@bible-strong/resource-catalog/strong-bibles')
const fr = ['LSG', 'DBY', 'DBR']
const en = ['KJV', 'NASB2020', 'NASB1995', 'BSB', 'ASV', 'DARBY', 'RLT', 'RWEBSTER', 'RV1895']
const datasets = { DBR: 'DBYR', DARBY: 'DARBY_EN' }
module.exports = {
  ...actual,
  FRENCH_STRONG_BIBLE_PRIORITY: fr,
  ENGLISH_STRONG_BIBLE_PRIORITY: en,
  STRONG_BIBLE_FALLBACK_PRIORITY: [...fr, ...en],
  getStrongBibleCatalogIdentity: id => ({
    versionId: id,
    datasetId: datasets[id] || id,
    language: fr.includes(id) ? 'fr' : 'en',
  }),
}
