/**
 * Alerts for a new class, sent by the CyberJudah server to an FCM topic when the classroom
 * channel posts a class or goes live. The phone never sends anything about the reader to the
 * server: it joins or leaves the topic with Firebase, and the server only ever sends to the topic.
 */

/** Android channel the alerts are shown on, so a reader can silence them apart from reminders. */
export const NEW_CLASS_CHANNEL = 'new-classes'

/**
 * Readers' builds (the production update channel) listen to the production server's topic;
 * the beta, Preview and development builds listen to the staging server's.
 */
export const newClassTopic = (updateChannel: string | null | undefined) =>
  updateChannel === 'production' ? 'new-classes' : 'new-classes-staging'

export type NewClassPress = { video: string; title?: string }

/** The class an alert opens, or nothing when the payload is not one of ours. */
export const readNewClassPress = (data: unknown): NewClassPress | undefined => {
  if (!data || typeof data !== 'object') return undefined
  const value = data as Record<string, unknown>
  if (value.kind !== 'new-class') return undefined
  if (typeof value.video !== 'string' || !/^[\w-]{11}$/.test(value.video)) return undefined
  const title =
    typeof value.title === 'string' && value.title.trim() ? value.title.slice(0, 200) : undefined
  return { video: value.video, title }
}
