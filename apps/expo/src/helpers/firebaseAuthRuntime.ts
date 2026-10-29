import { getApp } from '@react-native-firebase/app'
import {
  AppleAuthProvider,
  getAuth,
  reauthenticateWithCredential,
} from '@react-native-firebase/auth'
import { appleAuth } from '@invertase/react-native-apple-authentication'

import { requestAccountDeletion } from './requestAccountDeletion'

export const getCurrentAuthUser = () => getAuth().currentUser
export const deleteCurrentAuthUser = async () => {
  const user = getCurrentAuthUser()
  if (!user) return
  if (getApp().options.projectId !== 'cyberjudah-app') {
    throw new Error('Account deletion requires the CyberJudah Firebase project.')
  }
  let authorizationCode: string | undefined
  if (user.providerData.some(provider => provider.providerId === 'apple.com')) {
    const response = await appleAuth.performRequest({
      requestedOperation: appleAuth.Operation.LOGIN,
    })
    if (!response.identityToken || !response.nonce || !response.authorizationCode) {
      throw new Error('Sign in with Apple again before deleting your account.')
    }
    if (getCurrentAuthUser()?.uid !== user.uid) throw new Error('The signed-in account changed.')
    await reauthenticateWithCredential(
      user,
      AppleAuthProvider.credential(response.identityToken, response.nonce)
    )
    authorizationCode = response.authorizationCode
  }
  await requestAccountDeletion(user, authorizationCode, () => getCurrentAuthUser()?.uid)
}
