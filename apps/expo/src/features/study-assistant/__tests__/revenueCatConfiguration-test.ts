import { revenueCatPublicKey } from '../revenueCatConfiguration'
const testKey = 'test_examplePublicKey'
it('uses the Test Store only in a staging development build', () => {
  expect(revenueCatPublicKey({ platform: 'ios', development: true, staging: true, testKey })).toBe(
    testKey
  )
  expect(
    revenueCatPublicKey({ platform: 'ios', development: false, staging: true, testKey })
  ).toBeUndefined()
  expect(
    revenueCatPublicKey({ platform: 'ios', development: true, staging: false, testKey })
  ).toBeUndefined()
})
it('uses the platform store key in TestFlight even if a local test key is present', () => {
  expect(
    revenueCatPublicKey({
      platform: 'ios',
      development: false,
      staging: true,
      testKey,
      iosKey: 'appl_publicKey',
    })
  ).toBe('appl_publicKey')
})
it('rejects secret, wrong-platform and Test Store keys in store key fields', () => {
  for (const iosKey of ['sk_secret', 'goog_android', testKey]) {
    expect(
      revenueCatPublicKey({ platform: 'ios', development: false, staging: true, iosKey })
    ).toBeUndefined()
  }
  expect(
    revenueCatPublicKey({ platform: 'web', development: true, staging: true, testKey })
  ).toBeUndefined()
})
