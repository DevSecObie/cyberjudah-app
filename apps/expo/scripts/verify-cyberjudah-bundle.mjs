import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
// Build 303 shipped a bundle without the CyberJudah public settings: the app fell back to
// Bible Strong's Google client and resource catalog. Check the bundle that will ship, not the
// source or the environment that was supposed to produce it.
const app = resolve(import.meta.dirname, '..'),
  bundlePath = process.argv[2]
if (!bundlePath) throw new Error('Pass the path of the built JavaScript bundle')
const bundle = (await readFile(bundlePath)).toString('latin1')
// The production store build checks against its own settings file.
const production = process.env.CYBERJUDAH_IOS_TARGET === 'production'
const settingsFile = production ? '.env.cyberjudah.production.example' : '.env.cyberjudah.example'
const settings = Object.fromEntries(
  (await readFile(resolve(app, settingsFile), 'utf8'))
    .split('\n')
    .map(line => line.match(/^(EXPO_PUBLIC_[A-Z_]+)="?([^"]*)"?$/))
    .filter(Boolean)
    .map(([, key, value]) => [key, value])
)
// The Google client is inlined from the environment; the Bible name only survives when the
// resource profile was inlined as cyberjudah.
const required = [settings.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, 'King James Version with Apocrypha']
const missing = required.filter(value => !value || !bundle.includes(value))
if (missing.length) throw new Error(`Bundle is missing CyberJudah settings: ${missing.join(', ')}`)
// Bible Strong's own Firebase sender: its Google client fallback or its environment files.
if (bundle.includes('204116128917'))
  throw new Error('Bundle contains Bible Strong Firebase settings')
// The store build must carry the production server address from its own settings file. (The
// staging address can't be ruled out by text: it stays in the code's fallbacks and in the
// bundled offline catalog, which the app rewrites to its own server.)
if (production && !bundle.includes(settings.EXPO_PUBLIC_CYBERJUDAH_API_URL))
  throw new Error('Production bundle is missing the production server')
console.log(`${bundlePath}: CyberJudah public settings verified in the shipped bundle`)
