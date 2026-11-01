/**
 * What the reader actually got to the end of: a note scrolled to its last line, the last chapter
 * of a plan passage read to its end, a quiz answered through. A plan element is ticked when its
 * page closes only if it was finished there; opening it is not reading it.
 */
const finished = new Set<string>()

export const noteReadingKey = (notePath: string) => `note:${notePath}`
export const chaptersReadingKey = (chapters: string) => `chapters:${chapters}`
export const entityReadingKey = (planId: string, readingSliceId: string, entitySliceId: string) =>
  `entity:${planId}/${readingSliceId}/${entitySliceId}`

const listeners = new Set<(key: string) => void>()

export const finishReading = (key: string) => {
  finished.add(key)
  listeners.forEach(listener => listener(key))
}

/** Hears each element as it is finished, wherever the reader is at that moment. */
export const onFinishedReading = (listener: (key: string) => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Whether it was finished since it was opened; asking clears it for the next time. */
export const takeFinishedReading = (key: string) => finished.delete(key)

export const forgetFinishedReading = (key: string) => {
  finished.delete(key)
}
