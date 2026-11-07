import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

// Crash reports may only go to CyberJudah's own GlitchTip (errors.cyberjudah.io) or nowhere.
// The fork shipped the upstream author's sentry.io DSN in .env.staging/.env.development, which
// sent CyberJudah dev and staging crashes to a third party. This keeps that from coming back.
const appDir = join(__dirname, '..', '..', '..')
const envFiles = readdirSync(appDir).filter(
  name => name.startsWith('.env') && name !== '.env' && !name.endsWith('.local')
)

describe('Sentry DSN ownership', () => {
  it('finds the env files', () => {
    expect(envFiles).toEqual(expect.arrayContaining(['.env.development', '.env.production']))
  })

  it.each(envFiles)('%s sends crash reports only to CyberJudah or nowhere', name => {
    const text = readFileSync(join(appDir, name), 'utf8')
    for (const match of text.matchAll(/^\s*EXPO_PUBLIC_SENTRY_DSN\s*=\s*"?([^"\n]*)"?/gm)) {
      const dsn = match[1].trim()
      if (dsn) expect(new URL(dsn).hostname).toBe('errors.cyberjudah.io')
    }
    expect(text).not.toMatch(/sentry\.io/)
  })
})
