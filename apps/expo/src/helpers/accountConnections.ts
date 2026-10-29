import { getCurrentAuthUser } from './firebaseAuthRuntime'

export type ConnectedProvider = { id: 'google.com' | 'apple.com' | 'password'; email: string }
export type AccountConnections = {
  uid: string
  providers: ConnectedProvider[]
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
