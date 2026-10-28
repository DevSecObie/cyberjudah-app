jest.mock('react-native-url-polyfill/auto', () => ({}))
jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
}))
jest.mock('~helpers/runtimeConfig', () => ({ isPlaygroundEnabled: false }))
jest.mock('~helpers/storage', () => ({
  storage: { getString: jest.fn(), set: jest.fn() },
}))

const enBase = require('../locales/en/translation.json') as Record<string, string>
const enOverlay = require('../locales/en/cyberjudah.json') as Record<string, string>
const frOverlay = require('../locales/fr/cyberjudah.json') as Record<string, string>

// Upstream names, people, addresses and referrals that must not reach CyberJudah readers.
const UPSTREAM_IDENTITY =
  /Bible Strong\b(?! par défaut)|bible-strong\.app|Stéphane|Adventist|adventiste|lestudio316|smontlouis|audibible/i

const loadI18n = async (profile: string | undefined, language: string) => {
  jest.resetModules()
  if (profile === undefined) delete process.env.EXPO_PUBLIC_RESOURCE_PROFILE
  else process.env.EXPO_PUBLIC_RESOURCE_PROFILE = profile
  const { storage } = await import('~helpers/storage')
  jest.mocked(storage.getString).mockReturnValue(language)
  const { default: i18n, setI18n } = await import('../index')
  await setI18n()
  return i18n
}

const previousProfile = process.env.EXPO_PUBLIC_RESOURCE_PROFILE
afterEach(() => {
  if (previousProfile === undefined) delete process.env.EXPO_PUBLIC_RESOURCE_PROFILE
  else process.env.EXPO_PUBLIC_RESOURCE_PROFILE = previousProfile
})

it.each([
  ['en', enOverlay],
  ['fr', frOverlay],
])('overrides only existing %s strings and names no upstream identity', (_, overlay) => {
  for (const [key, value] of Object.entries(overlay)) {
    // French falls back to the key itself, so the English catalog lists every key.
    expect(enBase).toHaveProperty([key])
    expect(value).not.toMatch(UPSTREAM_IDENTITY)
  }
})

it('covers the same keys in both languages', () => {
  expect(Object.keys(frOverlay).sort()).toEqual(Object.keys(enOverlay).sort())
})

it.each(['en', 'fr'])('names CyberJudah in the FAQ and rating prompt (%s)', async language => {
  const i18n = await loadI18n('cyberjudah', language)
  for (const key of [
    'faq.availabilityQuestion',
    'faq.availabilityAnswer',
    'faq.freeAnswer',
    'faq.syncAnswer',
    'faq.category.startTitle',
    'faq.bugNoticedAnswer',
    'faq.ideaAnswer',
    'rating.title',
  ]) {
    const text = i18n.t(key)
    expect(text).not.toMatch(UPSTREAM_IDENTITY)
  }
  expect(i18n.t('faq.category.startTitle')).toContain('CyberJudah')
  expect(i18n.t('faq.freeAnswer')).not.toMatch(/\bdons?\b|donat/i)
})

it('leaves the upstream build unchanged', async () => {
  const i18n = await loadI18n(undefined, 'en')
  expect(i18n.t('rating.title')).toBe(enBase['rating.title'])
  expect(i18n.t('faq.freeAnswer')).toBe(enBase['faq.freeAnswer'])
})
