import { appleAuth } from '@invertase/react-native-apple-authentication'
import {
  AppleAuthProvider,
  getAuth,
  reauthenticateWithCredential,
  revokeToken,
} from '@react-native-firebase/auth'
import { Platform } from 'react-native'

/**
 * App Store Review Guideline 5.1.1(v): deleting an account that signed in with Apple must also
 * revoke the app's Apple tokens. Apple hands out the authorization code that revocation needs only
 * at sign-in, so the reader confirms with Apple once more. That fresh sign-in also satisfies
 * Firebase's recent-login rule for deleting the account. Other providers need nothing here.
 */
export async function revokeAppleSignInIfLinked(): Promise<void> {
  const user = getAuth().currentUser
  if (!user || Platform.OS !== 'ios') return
  if (!user.providerData.some(provider => provider.providerId === 'apple.com')) return

  const response = await appleAuth.performRequest({
    requestedOperation: appleAuth.Operation.LOGIN,
    requestedScopes: [],
  })
  const { identityToken, nonce, authorizationCode } = response
  if (!identityToken || !authorizationCode)
    throw Object.assign(new Error('Apple did not confirm the sign-in.'), {
      code: 'auth/requires-recent-login',
    })

  // A different Apple ID must not revoke or delete this account.
  await reauthenticateWithCredential(user, AppleAuthProvider.credential(identityToken, nonce))
  await revokeToken(getAuth(), authorizationCode)
}
