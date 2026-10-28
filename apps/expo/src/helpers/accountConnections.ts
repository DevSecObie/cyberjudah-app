import { getCurrentAuthUser } from './firebaseAuthRuntime'

export type ConnectedProvider = { id: 'google.com' | 'apple.com' | 'password'; email: string }
export type TelegramConnection =
  | { status: 'checking' | 'not-connected' | 'unavailable'; label?: never }
  | { status: 'connected'; label?: string }
export type AccountConnections = {
  uid: string
  providers: ConnectedProvider[]
  telegram: TelegramConnection
}

const listeners = new Set<() => void>()
export const notifyAccountConnectionsChanged = () => listeners.forEach(listener => listener())
export const subscribeAccountConnections = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function connectedProviders(uid: string): ConnectedProvider[] {
  const user = getCurrentAuthUser()
  if (!user || user.uid !== uid) return []
  const providers = new Map<string, ConnectedProvider>()
  for (const provider of user.providerData) {
    const id = provider.providerId
    if (id === 'google.com' || id === 'apple.com' || id === 'password')
      providers.set(id, {
        id,
        email: provider.email || (id === 'password' ? user.email : '') || '',
      })
  }
  return [...providers.values()]
}

/** The bearer lookup proves a Telegram link for THIS Firebase account, not a browser cookie. */
export async function loadAccountConnections(
  uid: string,
  signal?: AbortSignal
): Promise<AccountConnections | null> {
  const user = getCurrentAuthUser()
  const current = () => !signal?.aborted && getCurrentAuthUser()?.uid === uid
  if (!user || user.uid !== uid || !current()) return null
  const result: AccountConnections = {
    uid,
    providers: connectedProviders(uid),
    telegram: { status: 'unavailable' },
  }
  const origin = process.env.EXPO_PUBLIC_CYBERJUDAH_API_URL
  if (!origin || process.env.EXPO_PUBLIC_RESOURCE_PROFILE !== 'cyberjudah') return result
  try {
    const token = await user.getIdToken()
    if (!current()) return null
    const response = await fetch(`${origin}/api/me`, {
      headers: { authorization: `Bearer ${token}` },
      credentials: 'omit',
      cache: 'no-store',
      signal,
    })
    const body = await response.json()
    if (!current()) return null
    if (response.status === 401 && body.error === 'telegram_link_required') {
      result.telegram = { status: 'not-connected' }
    } else if (response.ok && Number.isSafeInteger(body.user?.id) && body.user.id > 0) {
      result.telegram = { status: 'connected' }
      // The browser can supply the friendly Telegram name only if it is the verified link.
      // A different Telegram session must never label the Firebase account as that person.
      try {
        const sessionResponse = await fetch(`${origin}/api/auth/status`, {
          credentials: 'same-origin',
          cache: 'no-store',
          signal,
        })
        const session = await sessionResponse.json()
        if (sessionResponse.ok && session.user?.id === body.user.id) {
          const username = session.user.username
          const name = session.user.first_name
          if (typeof username === 'string' && username) result.telegram.label = `@${username}`
          else if (typeof name === 'string' && name) result.telegram.label = name
        }
      } catch {
        /* The verified link remains valid even when its friendly name is unavailable. */
      }
    }
  } catch {
    /* Keep connection failures distinct from an unlinked account. */
  }
  return current() ? result : null
}
