jest.mock('expo/virtual/env', () => ({ env: process.env }))
import catalog from '../../assets/cyberjudah/offline-catalog.json'
import { isCyberJudahPublicArchive } from '../cyberJudahPublicArchive'
const previous = process.env.EXPO_PUBLIC_RESOURCE_PROFILE
afterAll(() => {
  if (previous === undefined) delete process.env.EXPO_PUBLIC_RESOURCE_PROFILE
  else process.env.EXPO_PUBLIC_RESOURCE_PROFILE = previous
})
it('allows only the exact published CyberJudah archives and their hashes', () => {
  process.env.EXPO_PUBLIC_RESOURCE_PROFILE = 'cyberjudah'
  for (const entry of Object.values(catalog.resources)) {
    expect(isCyberJudahPublicArchive(entry.url, entry.archiveSha256)).toBe(true)
    expect(isCyberJudahPublicArchive(entry.url, '0'.repeat(64))).toBe(false)
    expect(
      isCyberJudahPublicArchive(
        entry.url.replace('cyberjudah-telegram-staging.oisrae1.workers.dev', 'example.com'),
        entry.archiveSha256
      )
    ).toBe(false)
    expect(
      isCyberJudahPublicArchive(entry.url.replace('/offline/', '/private/'), entry.archiveSha256)
    ).toBe(false)
  }
})
it('never exempts original Bible Strong downloads', () => {
  process.env.EXPO_PUBLIC_RESOURCE_PROFILE = 'upstream'
  const entry = catalog.resources['bible:KJV']
  expect(isCyberJudahPublicArchive(entry.url, entry.archiveSha256)).toBe(false)
})
it('bundles a valid catalog and matches the native Strong dataset identity', () => {
  process.env.EXPO_PUBLIC_RESOURCE_PROFILE = 'cyberjudah'
  jest.isolateModules(() => {
    const {
      isMobileResourceCatalog,
      getMobileBibleVersionIds,
    } = require('../mobileResourceCatalog')
    const { getStrongDatasetId } = require('../strongBiblePublications')
    expect(isMobileResourceCatalog(catalog)).toBe(true)
    expect(getMobileBibleVersionIds()).toEqual(['KJV'])
    expect(getStrongDatasetId('KJV')).toBe('CYBERJUDAH')
    expect(getStrongDatasetId('LSG')).toBeUndefined()
  })
})
