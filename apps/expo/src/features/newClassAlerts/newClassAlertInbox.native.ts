import { createMMKV } from 'react-native-mmkv'
import { readNewClassPress, type NewClassPress } from './newClassAlertRules'

/**
 * A pressed alert the background handler saw (it cannot navigate), kept until the app is up.
 * Kept apart from the screen code so the headless handler loads only this.
 */
let inbox: ReturnType<typeof createMMKV> | undefined
const store = () => (inbox ??= createMMKV({ id: 'new-class-alerts-inbox' }))
const PENDING = 'pending'

export const rememberNewClassPress = (data: unknown) => {
  const press = readNewClassPress(data)
  if (press) store().set(PENDING, JSON.stringify(press))
}

export const takeNewClassPress = (): NewClassPress | undefined => {
  const raw = store().getString(PENDING)
  if (!raw) return undefined
  store().remove(PENDING)
  try {
    return readNewClassPress({ ...JSON.parse(raw), kind: 'new-class' })
  } catch {
    return undefined
  }
}
