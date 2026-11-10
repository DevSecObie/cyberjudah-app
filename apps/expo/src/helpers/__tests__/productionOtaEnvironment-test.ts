import { readFileSync } from 'node:fs'
import path from 'node:path'
import { parse } from 'dotenv'
import eas from '../../../eas.json'

it('ships the same public and build settings in production OTAs as the store build', () => {
  const ota = parse(
    readFileSync(path.resolve(__dirname, '../../../.env.cyberjudah.production.example'))
  )
  const build = eas.build.production.env
  expect(
    Object.keys(ota)
      .filter(key => key !== 'OTA_URL')
      .sort()
  ).toEqual(Object.keys(build).sort())
  // Never print environment values in a failed assertion: report only which key differs.
  for (const [key, value] of Object.entries(build)) {
    expect({ key, matches: ota[key] === value }).toEqual({ key, matches: true })
  }
  expect(ota.OTA_URL).toBe('https://updates.cyberjudah.io')
})
