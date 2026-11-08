import fs from 'node:fs'
import path from 'node:path'
import {
  AUDIO_PLAYBACK_ENABLED,
  DYNAMIC_RESOURCE_API_ENABLED,
  SEARCH_TELEMETRY_ENABLED,
  STUDY_PUBLICATION_ENABLED,
  TIMELINE_PICTURES_ENABLED,
} from '../serviceConnections'
import { getTimelineImageUri } from '~features/timeline/timelineImage'
import { hasStrongAudio } from '~features/bible/ListenStrong'

const app = path.resolve(__dirname, '../../..')
const repo = path.resolve(app, '../..')
const read = (file: string) => fs.readFileSync(file, 'utf8')
const forbiddenHosts =
  /(?:workers\.dev|https?:\/\/[^\s/"']*staging[^\s/"']*|content\.swncdn\.com|s\.topchretien\.com|(?:www\.)?wordpocket\.org|bible\.audio|timeline\.biblehistory\.com)/i
const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(file)
    return /\.(?:tsx?|json|txt)$/.test(file) && !/[-.]test\./.test(file) ? [file] : []
  })

describe('clean build connections', () => {
  it('ships no unapproved audio, search telemetry, pictures, publishing or dynamic API capability', () => {
    expect([
      AUDIO_PLAYBACK_ENABLED,
      SEARCH_TELEMETRY_ENABLED,
      TIMELINE_PICTURES_ENABLED,
      STUDY_PUBLICATION_ENABLED,
      DYNAMIC_RESOURCE_API_ENABLED,
    ]).toEqual([false, false, false, false, false])
    expect(hasStrongAudio('hebreu', 1)).toBe(false)
    expect(hasStrongAudio('grec', 5624)).toBe(false)
    expect(getTimelineImageUri('https://example.org/picture.jpg')).toBeUndefined()
  })

  it('has no staging, worker, third-party audio or timeline picture host in shipped source/config', () => {
    const files = [
      ...sourceFiles(path.join(app, 'src')),
      path.join(app, 'app.config.ts'),
      path.join(app, 'eas.json'),
      path.join(app, '.env.production'),
    ].filter(fs.existsSync)
    const offending = files
      .filter(file => forbiddenHosts.test(read(file)))
      .map(file => path.relative(app, file))
    expect(offending).toEqual([])
  })

  it('uses the owned production origin for every shipped download catalog', () => {
    const files = [
      path.join(repo, 'packages/resource-catalog/src/mobile-resource-catalog.json'),
      path.join(app, 'public/offline/catalog.json'),
      path.join(app, 'src/assets/cyberjudah/offline-catalog.json'),
    ]
    for (const file of files.filter(fs.existsSync)) {
      const catalog = JSON.parse(read(file))
      for (const entry of Object.values(catalog.resources) as { url: string }[]) {
        const url = new URL(entry.url)
        expect(url.origin).toBe('https://api.cyberjudah.io')
        expect(url.pathname.startsWith('/v1/offline-artifacts/')).toBe(true)
      }
    }
  })
})
