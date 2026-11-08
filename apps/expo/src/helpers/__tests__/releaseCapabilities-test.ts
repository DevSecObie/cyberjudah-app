import appPackage from '../../../package.json'
import translation from '../../../i18n/locales/en/translation.json'
import { existsSync } from 'node:fs'
import path from 'node:path'
jest.mock('~features/studies/studyMarkdown', () => ({ studyMarkdown: () => 'fixture' }))
import eas from '../../../eas.json'
import catalog from '../../assets/cyberjudah/offline-catalog.json'
jest.mock('expo-modules-core', () => ({ uuid: { v4: () => 'verification-trace' } }))
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }))
jest.mock('~helpers/firebaseAuthRuntime', () => ({
  getCurrentAuthUser: () => ({ getIdToken: async () => 'local-test-token' }),
}))

import {
  putPublishedStudy,
  deletePublishedStudy,
  publishedStudyStatus,
  publishedStudyUrl,
} from '~features/studies/publishedStudies'
import {
  TEXT_TO_SPEECH_ENABLED,
  SEARCH_TELEMETRY_ENABLED,
  isOwnedAudioUrl,
} from '../releaseCapabilities'
import type { Study } from '~redux/modules/user'

describe('build 315 release omissions', () => {
  it('keeps study publishing and public links on the owner’s production backend', async () => {
    const fetcher = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({ ok: true, status: 200 } as Response)
    await putPublishedStudy({
      id: 'local-study',
      title: 'Local fixture',
      created_at: 0,
      modified_at: 0,
      content: { ops: [] },
      user: { displayName: '', id: 'local-account', photoUrl: '' },
    } as Study)
    expect(fetcher).toHaveBeenCalledWith(
      'https://cyberjudah.io/api/published-studies/local-study',
      expect.objectContaining({ method: 'PUT' })
    )
    await deletePublishedStudy('local-study')
    expect(fetcher).toHaveBeenCalledWith(
      'https://cyberjudah.io/api/published-studies/local-study',
      expect.objectContaining({ method: 'DELETE' })
    )
    expect(await publishedStudyStatus('local-study')).toBe(200)
    expect(publishedStudyUrl('local-study')).toBe('https://cyberjudah.io/app/published/local-study')
    fetcher.mockRestore()
  })

  it('keeps TTS and search tracking off', () => {
    expect(TEXT_TO_SPEECH_ENABLED).toBe(false)
    expect(SEARCH_TELEMETRY_ENABLED).toBe(false)
  })

  it('permits only the owner’s HTTPS audio hosts', () => {
    expect(isOwnedAudioUrl('https://cyberjudah.io/api/audio/recordings/clip.m4a')).toBe(true)
    expect(isOwnedAudioUrl('https://media.cyberjudah.io/clip.m4a')).toBe(true)
    expect(isOwnedAudioUrl('https://outside.example/clip.mp3')).toBe(false)
    expect(isOwnedAudioUrl('https://cyberjudah.io.outside.example/clip.mp3')).toBe(false)
    expect(isOwnedAudioUrl('http://media.cyberjudah.io/clip.m4a')).toBe(false)
  })
})

it('ships only production download URLs and the owner’s crash-reporting DSN', () => {
  expect(new URL(eas.build.production.env.EXPO_PUBLIC_SENTRY_DSN).hostname).toBe(
    'errors.cyberjudah.io'
  )
  for (const value of Object.values(eas.build.production.env)) {
    expect(value).not.toMatch(/workers\.dev|staging/i)
  }
  for (const entry of Object.values(catalog.resources)) {
    const url = new URL(entry.url)
    expect(['cyberjudah.io', 'api.cyberjudah.io']).toContain(url.hostname)
    expect(url.protocol).toBe('https:')
    expect(entry.url).not.toMatch(/workers\.dev|staging/i)
  }
})

it('omits the removed SDKs, routes and English provider labels from the shipped app', () => {
  const dependencies = appPackage.dependencies as Record<string, string>
  for (const name of [
    'react-native-purchases',
    'react-native-purchases-ui',
    'expo-speech',
    '@assistant-ui/react',
    '@assistant-ui/react-native',
    '@assistant-ui/react-streamdown',
    '@bible-strong/ai-contract',
  ]) {
    expect(dependencies).not.toHaveProperty(name)
  }
  const appRoot = path.resolve(__dirname, '../../..')
  expect(existsSync(path.join(appRoot, 'app/study-assistant.tsx'))).toBe(false)
  expect(existsSync(path.join(appRoot, 'app/ai-widgets.tsx'))).toBe(false)
  expect(
    Object.keys(translation).some(key => /^(assistant\.|askChat\.|askCredits\.)/.test(key))
  ).toBe(false)
  expect(
    Object.values(translation).some(value =>
      /telegram|revenuecat|glitchtip|openai|gloo/i.test(String(value))
    )
  ).toBe(false)
})
