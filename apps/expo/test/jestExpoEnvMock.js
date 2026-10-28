// Expo rewrites public environment reads to this ESM module in app code.
// Jest keeps the same live environment object while using its CommonJS runner.
module.exports = { env: process.env }
