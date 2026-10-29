import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
// Build 303 shipped a bundle without the CyberJudah public settings: the app fell back to
// Bible Strong's Google client and resource catalog. Check the bundle that will ship, not the
// source or the environment that was supposed to produce it.
const app = resolve(import.meta.dirname, '..'),
  bundlePath = process.argv[2]
if (!bundlePath) throw new Error('Pass the path of the built JavaScript bundle')
const bundle = (await readFile(bundlePath)).toString('latin1')
const settings = Object.fromEntries(
  (await readFile(resolve(app, '.env.cyberjudah.example'), 'utf8'))
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
if (bundle.includes('204116128917')) throw new Error('Bundle contains Bible Strong Firebase settings')
console.log(`${bundlePath}: CyberJudah public settings verified in the shipped bundle`)
