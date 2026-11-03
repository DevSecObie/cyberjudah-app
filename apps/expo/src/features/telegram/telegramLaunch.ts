// Telegram opens CyberJudah's web app (web.cyberjudah.io) as its Mini App. It hands the page its
// launch data in the address's #fragment; this reads it before the router can rewrite the address.

/** The launch parameters Telegram put in the address (tgWebAppData, tgWebAppStartParam…). */
export const readTelegramLaunch = (hash: string, search: string): Record<string, string> => {
  const params: Record<string, string> = {}
  for (const part of [hash.replace(/^#/, ''), search.replace(/^\?/, '')]) {
    for (const [key, value] of new URLSearchParams(part)) {
      if (/^tgWebApp/.test(key) && !(key in params)) params[key] = value
    }
  }
  return params
}

const SAFE = /^[A-Za-z0-9_-]{1,512}$/
const SEGMENT = /^[a-z0-9][a-z0-9-]*$/
const VERSES = /^\d+(-\d+)?(x\d+(-\d+)?)*$/

/**
 * The page a Telegram start parameter opens, as the Telegram app reads it (shared/links.mjs in
 * cyberjudah-telegram): "genesis_1" or "bible_genesis_1_3-5" opens that chapter at its verses.
 * Anything else opens the home page.
 */
export const startParamToRoute = (param: string | undefined): string | null => {
  if (!param || !SAFE.test(param)) return null
  const parts = param.toLowerCase().split('_').filter(Boolean)
  if (!parts.length || !parts.every(part => SEGMENT.test(part))) return null
  if (parts[0] === 'bible') parts.shift()
  const [book, chapter, verses] = parts
  if (!book || !chapter || !/^\d+$/.test(chapter) || parts.length > 3) return null
  if (verses && !VERSES.test(verses)) return null
  const first = verses?.match(/^\d+/)?.[0]
  return `/bible/${book}/${chapter}${first ? `/${first}` : ''}`
}
