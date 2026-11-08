/* global jest */
// Opt-in only: exercise upstream reader algorithms against their original complete catalog.
const actual = jest.requireActual('@bible-strong/resource-catalog/catalog')
module.exports = {
  ...actual,
  BUNDLED_MOBILE_RESOURCE_CATALOG: require('./fixtures/upstream-resource-catalog.json'),
}
