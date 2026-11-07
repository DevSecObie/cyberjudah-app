import type { Breadcrumb, ErrorEvent, ReactNativeOptions } from '@sentry/react-native'

import { redactDiagnosticText, sanitizeDiagnosticPayload } from './agentObservability'

// CyberJudah sends crash reports to its own GlitchTip (errors.cyberjudah.io). These hooks keep
// readers' data out of them: no user details beyond the account id, no request headers or
// bodies, no query string or fragment in any URL (they can hold search text, tokens or ids), no
// password in a URL, no console output, no element labels, no device name, and emails, bearer
// tokens and JWTs redacted from every free-text field. GlitchTip scrubs again on arrival and
// stores no IP address (ask-cyberjudah-monitoring: ingest-proxy and GLITCHTIP_PII_SCRUB_DEFAULT).
// Hard native crashes are sent by the native SDK and skip these hooks: FireAuth sets nothing but
// the account id, and iOS records no automatic breadcrumbs (RootLayout.native.tsx). Android keeps
// its native lifecycle, system and connectivity breadcrumbs, which carry no reader data.

type EventHint = Parameters<NonNullable<ReactNativeOptions['beforeSend']>>[1]
type EventHook = (event: ErrorEvent, hint: EventHint) => ErrorEvent | null

const MAX_TEXT_LENGTH = 8_000
const MAX_DEPTH = 6
// No whitespace-free run longer than this survives. Base64, minified code and JSON blobs are no
// help in a crash report and may hold data, and short runs bound the cost of every regex used
// here (including the email and JWT patterns in redactDiagnosticText) on the JS thread, while the
// app reports a crash.
const MAX_TOKEN_LENGTH = 200
// A stack location kept on a script URL whose query is dropped: `app.js?v=1:10:5)` -> `:10:5)`.
const SCRIPT_FILE = /\.(?:js|mjs|cjs|bundle|hbc)$/
const LINE_AND_COLUMN = /^\?[^\s:]*(:\d+:\d+\)?)$/
const URL_CHARACTER = /[A-Za-z0-9+.-]/

const firstQueryIndex = (text: string, from = 0) => {
  const question = text.indexOf('?', from)
  const hash = text.indexOf('#', from)
  if (question === -1) return hash
  if (hash === -1) return question
  return Math.min(question, hash)
}

// `scheme://user:password@host/path?query#hash`. Credentials go when the authority (up to the
// first `/`, `?` or `#`) holds an `@`, or when the text up to the first `@` holds a `:` (a
// password may hold `/`, `?` or `#`). If that text also holds `?`, `#`, `=` or `&`, nothing after
// the scheme is kept: it may be a password or a query. This errs on the side of redacting
// (`host:8080/users/@me` loses its host). Everything from the first `?` or `#` goes too; `cut`
// says the URL lost something that may carry on past it.
const redactUrl = (url: string) => {
  const authorityStart = url.indexOf('://') + 3
  const authorityEnd = firstOf(url, ['/', '?', '#'], authorityStart)
  let at = url.lastIndexOf('@', authorityEnd - 1)
  if (at < authorityStart) {
    const firstAt = url.indexOf('@', authorityStart)
    const userinfo = firstAt === -1 ? '' : url.slice(authorityStart, firstAt)
    if (userinfo.includes(':')) {
      if (/[?#=&]/.test(userinfo))
        return { url: `${url.slice(0, authorityStart)}[REDACTED]`, cut: true }
      at = firstAt
    }
  }
  const result =
    at >= authorityStart ? `${url.slice(0, authorityStart)}[REDACTED]${url.slice(at)}` : url
  const queryStart = firstQueryIndex(result, authorityStart)
  if (queryStart === -1) return { url: result, cut: false }
  const kept = result.slice(0, queryStart)
  const location = SCRIPT_FILE.test(kept)
    ? (result.slice(queryStart).match(LINE_AND_COLUMN)?.[1] ?? '')
    : ''
  return { url: kept + location, cut: true }
}

/** The first index of any of `characters` from `from`, or the text's length. */
const firstOf = (text: string, characters: string[], from: number) => {
  let first = text.length
  for (const character of characters) {
    const index = text.indexOf(character, from)
    if (index !== -1 && index < first) first = index
  }
  return first
}

// Text with no scheme is cut at the first `?` or `#` inside a word (`search?prayer`,
// `notes#prayer`, `/notes?term`) or followed somewhere by `=` (`?q=`, `#access_token=`,
// `mailto:…?subject=`). A lone `Why?` or `#1` stays. Right after a URL (`…/Foo_(bar)#note`) any
// `?` or `#` is cut.
const redactPlain = (text: string, afterUrl = false) => {
  const lastEquals = text.lastIndexOf('=')
  for (let index = 0; index < text.length; index++) {
    const character = text[index]
    if (character !== '?' && character !== '#') continue
    const insideWord = index > 0 && index < text.length - 1
    if (afterUrl || insideWord || lastEquals > index)
      return { text: text.slice(0, index), cut: true }
  }
  return { text, cut: false }
}

// A URL ends at whitespace (tokens are split on it), a quote, an angle bracket, a bracket, a
// comma or a `|`, so each URL in a JSON string or a list is handled on its own. Once something is
// cut, the rest of the token goes with it: a query may carry on past those characters.
const URL_END = new Set(['"', "'", '`', '<', '>', '(', ')', '[', ']', '{', '}', ',', '|'])

const redactToken = (token: string) => {
  let result = ''
  let position = 0
  let cut = false
  let afterUrl = false
  while (position < token.length) {
    const schemeEnd = token.indexOf('://', position)
    if (schemeEnd === -1) {
      const plain = redactPlain(token.slice(position), afterUrl)
      result += plain.text
      cut = plain.cut
      break
    }
    let schemeStart = schemeEnd
    while (schemeStart > position && URL_CHARACTER.test(token[schemeStart - 1])) schemeStart--
    const plain = redactPlain(token.slice(position, schemeStart), afterUrl)
    result += plain.text
    if (plain.cut) {
      cut = true
      break
    }
    let urlEnd = schemeEnd + 3
    while (urlEnd < token.length && !URL_END.has(token[urlEnd])) urlEnd++
    const url = redactUrl(token.slice(schemeStart, urlEnd))
    result += url.url
    if (url.cut) {
      cut = true
      break
    }
    position = urlEnd
    afterUrl = true
  }
  return {
    text: result.length > MAX_TOKEN_LENGTH ? `[${result.length} chars]` : result,
    cut,
  }
}

// Secrets that need no URL: `Basic <credentials>`, `token=…`/`password=…` and quoted JSON
// `"refreshToken": "…"` values (not `AuthError: …`, which is an error, not a secret). Runs only on text whose tokens are at most MAX_TOKEN_LENGTH long.
const BASIC_CREDENTIALS = /\bBasic\s+[A-Za-z0-9+/=._~-]+/g
const SECRET_VALUE =
  /(\b\w*(?:token|password|passwd|pwd|secret|apikey|api_key|auth|session|cookie)\w*)(=|["']\s*:\s*["'])[^\s"'&,;]+/gi
// Any address, accented letters included (the shared pattern is ASCII-only).
const EMAIL = /[^\s@"'<>()[\]{},;:]+@[^\s@"'<>()[\]{},;:]+\.[^\s@"'<>()[\]{},;:.]{2,}/g

export const redactText = (value: string, maxLength = MAX_TEXT_LENGTH): string => {
  // Events can break their declared types: an object is scrubbed deeply (throwing here would
  // lose the whole report), and a number or boolean holds no text.
  if (typeof value !== 'string') return redactDeep(value) as string
  // Only about maxLength characters are scanned, cut between tokens so no secret is split in two.
  let text = value
  if (text.length > maxLength + MAX_TOKEN_LENGTH) {
    text = text.slice(0, maxLength + MAX_TOKEN_LENGTH)
    const lastSpace = text.search(/\s\S*$/)
    text = lastSpace === -1 ? text : text.slice(0, lastSpace)
  }
  // Once a token loses a query, the rest of its line goes: a search with spaces in it
  // (`search?q=pray for my mother`) carries on into the next tokens.
  const lines = text.split('\n').map(line => {
    let result = ''
    for (const part of line.split(/(\s+)/)) {
      if (/^\s*$/.test(part)) {
        result += part
        continue
      }
      const token = redactToken(part)
      result += token.text
      if (token.cut) break
    }
    return result
  })
  // The shared patterns (Bearer tokens, JWTs, emails) go first, so a later pattern can't take
  // the word `Bearer` for the secret and leave the token after it.
  const redacted = redactDiagnosticText(lines.join('\n'), Number.MAX_SAFE_INTEGER)
    .replace(BASIC_CREDENTIALS, 'Basic [REDACTED]')
    .replace(SECRET_VALUE, '$1$2[REDACTED]')
    .replace(EMAIL, '[REDACTED_EMAIL]')
  return redacted.length > maxLength ? `${redacted.slice(0, maxLength)}…` : redacted
}

// Web click and input breadcrumbs describe the element as a CSS selector whose `[...]`
// attributes carry aria-label (React Native Web's accessibilityLabel), title or alt text. Every
// attribute goes, quotes respected, and an unterminated one runs to the end.
export const stripSelectorAttributes = (selector: string) => {
  let result = ''
  let inAttribute = false
  let quote = ''
  for (const char of selector) {
    if (!inAttribute) {
      if (char === '[') inAttribute = true
      else result += char
    } else if (quote) {
      if (char === quote) quote = ''
    } else if (char === '"' || char === "'") {
      quote = char
    } else if (char === ']') {
      inAttribute = false
    }
  }
  return result
}

// What a reader searched for, under any key that names it (appLogger's own list has only
// `searchtext`): `q`, `query`, `term`, `keyword(s)`, `search…`, `…Search`, `…Query`.
const SEARCH_KEY = /^(?:q|query|terms?|keywords?|search\w*|\w*(?:search|query))$/i

/** Redacts every string inside a value, at any depth, and whatever a search key holds. */
const redactDeep = (value: unknown, depth = 0): unknown => {
  if (typeof value === 'string') return redactText(value)
  if (!value || typeof value !== 'object') return value
  if (depth >= MAX_DEPTH) return '[max-depth]'
  if (Array.isArray(value)) return value.map(item => redactDeep(item, depth + 1))
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SEARCH_KEY.test(key) && item != null ? '[REDACTED]' : redactDeep(item, depth + 1),
    ])
  )
}

/** Key-based redaction (note, email, token...) and then text redaction of what is left. */
const sanitizeDeep = (value: Record<string, unknown>) =>
  redactDeep(sanitizeDiagnosticPayload(value)) as Record<string, unknown>

// Our own breadcrumbs (appLogger and the Redux logger) are sanitized where they are written; the
// text pass below still runs on them.
const isOwnBreadcrumb = (category = '') =>
  category === 'Dispatch' || category.startsWith('bible-strong.')

export const scrubSentryBreadcrumb = (breadcrumb: Breadcrumb): Breadcrumb | null => {
  // Console output can hold anything the app or a library logged.
  if (breadcrumb.category === 'console') return null

  const scrubbed: Breadcrumb = { ...breadcrumb }

  if (breadcrumb.category === 'touch') {
    // Accessibility labels can show what the reader wrote; component names are enough.
    const path = Array.isArray(breadcrumb.data?.path) ? breadcrumb.data.path : []
    scrubbed.message = 'Touch event'
    scrubbed.data = {
      path: path.map((node: { name?: unknown }) =>
        typeof node?.name === 'string' ? { name: node.name } : {}
      ),
    }
    return scrubbed
  }

  if (breadcrumb.category?.startsWith('ui.')) {
    // `div.css-1x > div[aria-label="My prayer list"]` keeps its tags and classes only.
    if (scrubbed.message) scrubbed.message = redactText(stripSelectorAttributes(scrubbed.message))
    delete scrubbed.data
    return scrubbed
  }

  if (scrubbed.message) scrubbed.message = redactText(scrubbed.message)
  if (scrubbed.data) {
    scrubbed.data = isOwnBreadcrumb(breadcrumb.category)
      ? (redactDeep(scrubbed.data) as Record<string, unknown>)
      : sanitizeDeep(scrubbed.data)
  }
  return scrubbed
}

type Frame = { vars?: unknown; filename?: string; abs_path?: string }
const scrubFrames = (frames: Frame[] | undefined) => {
  for (const frame of frames ?? []) {
    if (!frame) continue
    delete frame.vars
    if (frame.filename) frame.filename = redactText(frame.filename)
    if (frame.abs_path) frame.abs_path = redactText(frame.abs_path)
  }
}

// Contexts the SDK fills with device and app facts, and `diagnostic`, which appLogger sanitizes
// when it is written: these get the text pass only. Any other context is ours and is sanitized.
const TEXT_ONLY_CONTEXTS = new Set([
  'app',
  'device',
  'os',
  'runtime',
  'culture',
  'trace',
  'react',
  'react_native_context',
  'expo_updates',
  'expo_constants',
  'expo_device',
  'diagnostic',
])

export const scrubSentryEvent = (event: ErrorEvent): ErrorEvent => {
  // Only the pseudonymous account id (FireAuth sets nothing else): no email, name or IP.
  const userId = event.user?.id
  if (userId != null) event.user = { id: userId }
  else delete event.user
  delete event.server_name

  if (event.request) {
    event.request = event.request.url ? { url: redactText(event.request.url) } : {}
  }
  if (event.message) event.message = redactDeep(event.message) as string
  if (event.transaction) event.transaction = redactText(event.transaction)
  if (event.fingerprint) event.fingerprint = event.fingerprint.map(part => redactText(String(part)))
  if (event.logentry) event.logentry = redactDeep(event.logentry) as ErrorEvent['logentry']
  if (event.tags) event.tags = redactDeep(event.tags) as ErrorEvent['tags']

  for (const exception of event.exception?.values ?? []) {
    if (!exception) continue
    if (exception.type) exception.type = redactText(exception.type)
    if (exception.value) exception.value = redactText(exception.value)
    if (exception.mechanism?.data) {
      exception.mechanism.data = redactDeep(
        exception.mechanism.data
      ) as typeof exception.mechanism.data
    }
    scrubFrames(exception.stacktrace?.frames)
  }
  for (const thread of event.threads?.values ?? []) scrubFrames(thread?.stacktrace?.frames)

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs
      .filter(Boolean)
      .map(scrubSentryBreadcrumb)
      .filter((breadcrumb): breadcrumb is Breadcrumb => breadcrumb !== null)
  }

  if (event.extra) event.extra = sanitizeDeep(event.extra)

  if (event.contexts) {
    for (const [name, context] of Object.entries(event.contexts)) {
      if (!context) continue
      event.contexts[name] = (
        TEXT_ONLY_CONTEXTS.has(name) ? redactDeep(context) : sanitizeDeep(context)
      ) as typeof context
    }
    // The phone's name is often the owner's name ("Sarah's iPhone").
    if (event.contexts.device) delete event.contexts.device.name
  }

  return event
}

/** Runs the noise filter first (it reads the raw error codes), then scrubs what is kept. */
export const withPrivacy =
  (filter: EventHook): EventHook =>
  (event, hint) => {
    const kept = filter(event, hint)
    return kept && scrubSentryEvent(kept)
  }
