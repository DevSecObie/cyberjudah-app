import { databasesRef, databasesEnRef, biblesRef } from '../firebase'
import { BUNDLED_MOBILE_RESOURCE_CATALOG } from '../mobileResourceCatalog'

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: () => ({}),
  increment: () => 1,
}))
jest.mock('@react-native-firebase/storage', () => ({ getStorage: () => ({}), ref: () => ({}) }))
jest.mock('expo-file-system/legacy', () => ({ documentDirectory: '/documents/' }))
jest.mock('~i18n', () => ({ getLanguage: () => 'en' }))

it('initializes Firebase resource references without eagerly resolving withdrawn Nave resources', () => {
  expect(BUNDLED_MOBILE_RESOURCE_CATALOG.resources['database:NAVE:fr']).toBeUndefined()
  expect(BUNDLED_MOBILE_RESOURCE_CATALOG.resources['database:NAVE:en']).toBeDefined()
  expect(databasesRef.NAVE).toBeUndefined()
  expect(databasesEnRef.NAVE).toMatch(
    /^https:\/\/api\.cyberjudah\.io\/v1\/offline-artifacts\/databases\/en\/nave\.sqlite\.zip/
  )
  expect(
    Object.values(databasesRef).every(url => !url || url.startsWith('https://api.cyberjudah.io/'))
  ).toBe(true)
  expect(biblesRef.KJV).toBeDefined()
})
