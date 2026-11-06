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

type HostWindow = {
  parent?: unknown
  TelegramWebviewProxy?: unknown
  external?: unknown
}

/**
 * True only when the page really runs inside a Telegram client: the phone apps' webview bridge,
 * Telegram Desktop's bridge, or Telegram Web's frame. Launch data in the address alone is not
 * enough, because anyone can put someone else's launch data in a link and open it in a browser.
 */
export const isTelegramHost = (win: HostWindow): boolean => {
  if (win.TelegramWebviewProxy) return true
  const external = win.external as { notify?: unknown } | undefined
  if (external && typeof external === 'object' && 'notify' in external) return true
  return win.parent != null && win.parent !== win
}
