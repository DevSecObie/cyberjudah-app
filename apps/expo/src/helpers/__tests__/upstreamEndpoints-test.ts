import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'

// This repository builds only CyberJudah. `yarn start` once read an .env.development wired to the
// upstream Bible Strong author's Firebase project, resource API, AI worker and native Firebase
// configs, so a developer's sign-in and data went to services CyberJudah does not control.
// Only committed env files are checked: `.env` and `.env*.local` hold a developer's own values.
const appDir = join(__dirname, '..', '..', '..')
const envFiles = readdirSync(appDir).filter(
  name => name.startsWith('.env') && name !== '.env' && !name.endsWith('.local')
)

const UPSTREAM = [
  /bible-strong\.app/i, // api., media., assets., updates., web. and the public site
  /bible-strong-app/i, // the upstream Firebase project and its storage bucket
  /bible-strong\.workers\.dev/i, // the upstream study assistant worker
  /firebase\/(dev|staging|prod)\//, // the upstream author's native Firebase configs
  /com\.smontlouis\./, // the upstream app identifiers
]

const settings = (name: string) =>
  new Map(
    readFileSync(join(appDir, name), 'utf8')
      .split('\n')
      .map(line => line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/))
      .filter((match): match is RegExpMatchArray => match !== null)
      .map(match => [match[1], match[2]] as const)
  )

describe('env files stay on CyberJudah', () => {
  // The release workflows delete .env.development and .env.production before running the tests,
  // so only the CyberJudah examples, which every checkout keeps, are required here.
  it('finds the env files', () => {
    expect(envFiles).toEqual(
      expect.arrayContaining(['.env.cyberjudah.example', '.env.cyberjudah.production.example'])
    )
  })

  it.each(envFiles)('%s names no Bible Strong service', name => {
    const lines = readFileSync(join(appDir, name), 'utf8')
      .split('\n')
      .filter(line => !line.trimStart().startsWith('#'))
    for (const line of lines) {
      for (const pattern of UPSTREAM) expect(line).not.toMatch(pattern)
    }
  })

  it.each(envFiles)('%s selects the CyberJudah profile', name => {
    expect(settings(name).get('EXPO_PUBLIC_RESOURCE_PROFILE')).toBe('cyberjudah')
  })

  const hasDevelopment = existsSync(join(appDir, '.env.development'))
  ;(hasDevelopment ? it : it.skip)(
    '.env.development is the staging example run as the Preview dev app',
    () => {
      const development = settings('.env.development')
      const staging = settings('.env.cyberjudah.example')
      expect(development.get('BUNDLE_IDENTIFIER')).toBe('io.cyberjudah.app.preview')
      for (const name of ['APP_NAME', 'BUNDLE_IDENTIFIER']) {
        development.delete(name)
        staging.delete(name)
      }
      expect(Object.fromEntries(development)).toEqual(Object.fromEntries(staging))
    }
  )
})
