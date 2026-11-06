import { useRef } from 'react'

/**
 * Whether two values hold the same plain data (what a DOM component receives: objects, arrays,
 * strings, numbers). Class instances, maps and functions only match themselves.
 */
export const isSameData = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false
    for (let index = 0; index < a.length; index++) {
      if (!isSameData(a[index], b[index])) return false
    }
    return true
  }
  if (Array.isArray(b)) return false
  const prototype = Object.getPrototypeOf(a)
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    Object.getPrototypeOf(b) !== prototype
  )
    return false
  const keysA = Object.keys(a)
  if (keysA.length !== Object.keys(b).length) return false
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false
    if (!isSameData((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]))
      return false
  }
  return true
}

type Callback = (...args: unknown[]) => unknown

/**
 * The props the Bible reader received, kept the same from one render to the next while their
 * data stays the same. The screen around the reader rebuilds every prop each time it renders;
 * without this, each of those renders draws every verse again. Callbacks keep one identity and
 * call the latest one given.
 */
export function useStableDomProps<P extends object>(props: P): P {
  'use no memo'
  const latest = useRef(props)
  latest.current = props
  const callbacks = useRef(new Map<string, Callback>())
  const previous = useRef<Record<string, unknown> | null>(null)

  const before = previous.current
  const next: Record<string, unknown> = {}
  let changed = !before || Object.keys(before).length !== Object.keys(props).length
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'function') {
      let callback = callbacks.current.get(key)
      if (!callback) {
        callback = (...args: unknown[]) =>
          ((latest.current as Record<string, unknown>)[key] as Callback | undefined)?.(...args)
        callbacks.current.set(key, callback)
      }
      next[key] = callback
    } else {
      next[key] = before && key in before && isSameData(before[key], value) ? before[key] : value
    }
    if (!before || next[key] !== before[key]) changed = true
  }
  if (!changed && before) return before as P
  previous.current = next
  return next as P
}
