import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions/v1'
import { revokeAppleTokens } from './appleRevocation'
import { deleteStudyFiles } from './studyFiles'

const APPLE_SECRETS = [
  'APPLE_SIGN_IN_CLIENT_ID',
  'APPLE_SIGN_IN_TEAM_ID',
  'APPLE_SIGN_IN_KEY_ID',
  'APPLE_SIGN_IN_PRIVATE_KEY',
]

async function deleteAccountData(uid: string): Promise<void> {
  const db = admin.firestore()
  for (const prefix of ['', 'staging_']) {
    const studies = db.collection(`${prefix}studies`).where('user.id', '==', uid).limit(100)
    while (true) {
      const page = await studies.get()
      if (page.empty) break
      for (const study of page.docs) {
        await deleteStudyFiles(study.id)
        await db.recursiveDelete(study.ref)
      }
    }
    // Recursive deletion also covers conversations and descendants whose parent is missing.
    await db.recursiveDelete(db.collection(`${prefix}users`).doc(uid))
    await db.collection(`${prefix}users-status`).doc(uid).delete()
  }
}

export const deleteAccount = functions
  .runWith({ secrets: APPLE_SECRETS, maxInstances: 3, timeoutSeconds: 540, memory: '1GB' })
  .https.onCall(async (data: unknown, context) => {
    if (process.env.GCLOUD_PROJECT !== 'cyberjudah-app') {
      throw new functions.https.HttpsError('failed-precondition', 'Wrong account project.')
    }
    if (!context.auth || context.auth.token.firebase.sign_in_provider === 'anonymous') {
      throw new functions.https.HttpsError('unauthenticated', 'Sign in to delete your account.')
    }
    const now = Math.floor(Date.now() / 1000)
    const authTime = context.auth.token.auth_time
    if (!Number.isFinite(authTime) || authTime > now + 30 || now - authTime > 300) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Sign in again to delete your account.',
        {
          reason: 'requires-recent-login',
        }
      )
    }
    if (
      !data ||
      typeof data !== 'object' ||
      Array.isArray(data) ||
      Object.keys(data).some(key => key !== 'authorizationCode')
    ) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid deletion request.')
    }
    const { authorizationCode } = data as { authorizationCode?: unknown }
    if (
      authorizationCode !== undefined &&
      (typeof authorizationCode !== 'string' ||
        !authorizationCode.trim() ||
        authorizationCode.length > 4096)
    ) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid Apple authorization code.')
    }

    try {
      const user = await admin.auth().getUser(context.auth.uid)
      if (user.disabled || authTime * 1000 < Date.parse(user.tokensValidAfterTime || '')) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'Sign in again to delete your account.'
        )
      }
      const apple = user.providerData.find(provider => provider.providerId === 'apple.com')
      if (apple) {
        if (
          typeof authorizationCode !== 'string' ||
          !apple.uid ||
          context.auth.token.firebase.sign_in_provider !== 'apple.com'
        ) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            'Sign in with Apple again before deleting your account.'
          )
        }
        await revokeAppleTokens(authorizationCode, apple.uid, {
          clientId: process.env.APPLE_SIGN_IN_CLIENT_ID || '',
          teamId: process.env.APPLE_SIGN_IN_TEAM_ID || '',
          keyId: process.env.APPLE_SIGN_IN_KEY_ID || '',
          privateKey: process.env.APPLE_SIGN_IN_PRIVATE_KEY || '',
        })
      } else if (authorizationCode !== undefined) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'No Apple identity is linked to this account.'
        )
      }
      await deleteAccountData(user.uid)
      await admin.auth().deleteUser(user.uid)
      return { deleted: true }
    } catch (error) {
      if (error instanceof functions.https.HttpsError) throw error
      // Do not log codes, tokens, response bodies, or errors carrying provider credentials.
      throw new functions.https.HttpsError(
        'unavailable',
        'Account deletion could not finish. Please try again.'
      )
    }
  })
