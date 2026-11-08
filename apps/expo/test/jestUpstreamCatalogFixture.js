/* global jest */
// Opt-in fixture for upstream algorithms whose historical resources are absent in production.
const actual = jest.requireActual('../src/helpers/mobileResourceCatalog')
const catalog = require('./fixtures/upstream-resource-catalog.json')
module.exports = {
  ...actual,
  BUNDLED_MOBILE_RESOURCE_CATALOG: catalog,
  MOBILE_RESOURCE_CATALOG: catalog,
  hasMobileResourceCatalogEntry: id =>
    Boolean(module.exports.MOBILE_RESOURCE_CATALOG.resources[id]),
  getMobileResourceCatalogEntry: id => {
    const entry = module.exports.MOBILE_RESOURCE_CATALOG.resources[id]
    if (!entry) throw new Error(`MOBILE_RESOURCE_CATALOG_ENTRY_MISSING:${id}`)
    return entry
  },
}
