// effect's Schema module re-exports fast-check for generating test data (Arbitrary). The app
// never generates test data, so the web build ships this empty module instead of fast-check.
module.exports = {}
