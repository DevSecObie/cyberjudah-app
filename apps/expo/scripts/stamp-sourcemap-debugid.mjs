#!/usr/bin/env node
// Gives a release build's Hermes source map the debug ID that is inside its bundle, so GlitchTip
// can match crash stack traces to the map without a release name.
//
// Store builds turn Sentry's automatic upload off (SENTRY_DISABLE_AUTO_UPLOAD), and that also turns
// off the step that copies the debug ID into the map Hermes composes. The bundle itself still
// carries it as `sentry-dbid-<uuid>`, so it is read from there.
//
// Usage: node stamp-sourcemap-debugid.mjs <bundle> <source map>
// Fails when the bundle has no debug ID, has more than one, or the map already names another one.
import { readFileSync, writeFileSync } from 'node:fs'

const [bundlePath, mapPath] = process.argv.slice(2)
if (!bundlePath || !mapPath) {
  console.error('Usage: stamp-sourcemap-debugid.mjs <bundle> <source map>')
  process.exit(2)
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
// Hermes bytecode is binary; latin1 keeps every byte as one character so the ASCII ID is found.
const bundle = readFileSync(bundlePath).toString('latin1')
const ids = new Set([...bundle.matchAll(new RegExp(`sentry-dbid-(${UUID})`, 'gi'))].map(m => m[1].toLowerCase()))
if (ids.size !== 1) {
  console.error(`Expected one debug ID in ${bundlePath}, found ${ids.size}`)
  process.exit(1)
}
const [debugId] = ids

const map = JSON.parse(readFileSync(mapPath, 'utf8'))
const existing = (map.debugId || map.debug_id || '').toLowerCase()
if (existing && existing !== debugId) {
  console.error(`${mapPath} names debug ID ${existing}, but the bundle has ${debugId}`)
  process.exit(1)
}
if (!Array.isArray(map.sources) || typeof map.mappings !== 'string' || map.mappings.length === 0) {
  console.error(`${mapPath} is not a usable source map`)
  process.exit(1)
}
if (!existing) {
  map.debugId = debugId
  map.debug_id = debugId
  writeFileSync(mapPath, JSON.stringify(map))
}
console.log(`Source map debug ID ${debugId}`)
