import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  reauthenticateWithPopup,
  signInWithCustomToken,
} from 'firebase/auth'
import { firebaseApp } from './firebaseApp.web'
import { toast } from './toast'

const pendingKey = 'cyberjudah:link-telegram'
const enabled = process.env.EXPO_PUBLIC_RESOURCE_PROFILE === 'cyberjudah'
const api = (path: string, init?: RequestInit) =>
  fetch(`/api/${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', ...init?.headers },
  })
const errorMessage = (code: string) =>
  ({
    recent_firebase_sign_in_required: 'Sign in again before connecting Telegram.',
    recent_telegram_sign_in_required: 'Sign in to Telegram again to connect this account.',
    account_already_linked: 'This login is already connected to a different Telegram account.',
    telegram_already_linked: 'This Telegram account is already connected to another login.',
  })[code] ?? 'The accounts could not be connected. Please try again.'

async function finishLink(uid: string) {
  const auth = getAuth(firebaseApp)
  const user = auth.currentUser
  if (!user || user.uid !== uid)
    throw new Error('The signed-in account changed. Start connecting again.')
  const idToken = await user.getIdToken(true)
  if (auth.currentUser?.uid !== uid) throw new Error('The signed-in account changed.')
  const response = await api('firebase/link', { method: 'POST', body: JSON.stringify({ idToken }) })
  const result = await response.json()
  if (!response.ok) throw new Error(errorMessage(result.error))
  if (result.uid !== uid) throw new Error('Account verification did not match.')
  toast.success('Telegram connected. Your linked sign-ins share the same Ask account.')
}

/** Only an explicit click starts a link; merely having two sessions never merges them. */
export async function connectTelegramAccount() {
  if (!enabled) return
  const auth = getAuth(firebaseApp)
  const user = auth.currentUser
  if (!user) return
  try {
    const provider = user.providerData.find(
      p => p.providerId === 'google.com' || p.providerId === 'apple.com'
    )
    if (provider)
      await reauthenticateWithPopup(
        user,
        provider.providerId === 'google.com'
          ? new GoogleAuthProvider()
          : new OAuthProvider('apple.com')
      )
    if (auth.currentUser?.uid !== user.uid) throw new Error('The signed-in account changed.')
    // No token or identity proof is put in storage or in the redirect URL.
    sessionStorage.setItem(pendingKey, JSON.stringify({ uid: user.uid, created: Date.now() }))
    window.location.assign('/api/auth/start?return=profile')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Unable to connect Telegram.')
  }
}

export async function restoreCyberJudahSession() {
  if (!enabled) return
  const auth = getAuth(firebaseApp)
  await auth.authStateReady()
  try {
    const pending = sessionStorage.getItem(pendingKey)
    if (pending && new URLSearchParams(window.location.search).get('telegram') === 'returned') {
      sessionStorage.removeItem(pendingKey)
      const attempt = JSON.parse(pending)
      if (
        typeof attempt.uid !== 'string' ||
        Date.now() - attempt.created > 600_000 ||
        attempt.created > Date.now()
      )
        return
      await finishLink(attempt.uid)
      window.history.replaceState(null, '', '/profile')
      return
    }
    if (auth.currentUser || sessionStorage.getItem('cyberjudah:signed-out')) return
    const initialUser = auth.currentUser
    const response = await api('auth/status')
    const status = await response.json()
    if (!response.ok || !status.user || auth.currentUser !== initialUser) return
    const tokenResponse = await api('firebase/token', { method: 'POST' })
    const result = await tokenResponse.json()
    if (!tokenResponse.ok || typeof result.token !== 'string' || auth.currentUser !== initialUser)
      return
    await signInWithCustomToken(auth, result.token)
  } catch (error) {
    // Keep the standard reader available when account services cannot be reached.
    if (sessionStorage.getItem(pendingKey)) sessionStorage.removeItem(pendingKey)
    toast.error(error instanceof Error ? error.message : 'Unable to restore the account.')
  }
}

export async function endCyberJudahSession() {
  if (!enabled) return
  sessionStorage.setItem('cyberjudah:signed-out', '1')
  sessionStorage.removeItem(pendingKey)
  const response = await api('auth/logout', { method: 'POST' })
  if (!response.ok) throw new Error('Telegram could not be signed out. Please try again.')
}
