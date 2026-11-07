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

// `scheme://user:password@host/path?query#hash`. Credentials go: anything before an `@` in the
// authority (a password may hold `?`, `#` or `@`), or before the first `@` when the authority
// reads `user:non-port` (a raw `/` in the password ends the authority early). So does everything
// from the first `?` or `#`; `cut` says the query was dropped.
const redactUrl = (url: string) => {
  const authorityStart = url.indexOf('://') + 3
  const pathStart = url.indexOf('/', authorityStart)
  const authorityEnd = pathStart === -1 ? url.length : pathStart
  let at = url.lastIndexOf('@', authorityEnd - 1)
  if (at < authorityStart) {
    const authority = url.slice(authorityStart, authorityEnd)
    const afterColon = authority.slice(authority.indexOf(':') + 1)
    const queryStart = firstQueryIndex(url, authorityStart)
    const nextAt = url.indexOf('@', authorityEnd)
    const looksLikeUser = authority.includes(':') && afterColon !== '' && !/^\d+$/.test(afterColon)
    at = looksLikeUser && nextAt !== -1 && (queryStart === -1 || nextAt < queryStart) ? nextAt : -1
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

// Text with no scheme: `api/search?q=…`, `search?q=…`, `mailto:a@b.co?subject=…` lose the query
// (a `?` followed by `=`), and `/notes#…` the fragment. `Why?` and `#1` stay.
const redactPlain = (text: string) => {
  const queryStart = firstQueryIndex(text)
  if (queryStart <= 0 || queryStart === text.length - 1) return text
  const queryLike =
    text[queryStart] === '?'
      ? text.indexOf('=', queryStart) !== -1
      : text.lastIndexOf('/', queryStart) !== -1
  return queryLike ? text.slice(0, queryStart) : text
}

// A URL ends at whitespace (tokens are split on it), a quote or an angle bracket, so each URL in
// a JSON string is handled on its own. Once a query is cut, the rest of the token goes with it:
// the query may carry on past a quote or bracket (`?f={"a":1}&token=…`).
const URL_END = new Set(['"', "'", '`', '<', '>'])

const redactToken = (token: string) => {
  let result = ''
  let position = 0
  while (position < token.length) {
    const schemeEnd = token.indexOf('://', position)
    if (schemeEnd === -1) {
      result += redactPlain(token.slice(position))
      break
    }
    let schemeStart = schemeEnd
    while (schemeStart > position && URL_CHARACTER.test(token[schemeStart - 1])) schemeStart--
    const prefix = token.slice(position, schemeStart)
    const plain = redactPlain(prefix)
    result += plain
    if (plain !== prefix) break
    let urlEnd = schemeEnd + 3
    while (urlEnd < token.length && !URL_END.has(token[urlEnd])) urlEnd++
    const { url, cut } = redactUrl(token.slice(schemeStart, urlEnd))
    result += url
    if (cut) break
    position = urlEnd
  }
  return result.length > MAX_TOKEN_LENGTH ? `[${result.length} chars]` : result
}

export const redactText = (value: string, maxLength = MAX_TEXT_LENGTH) => {
  // Only about maxLength characters are scanned, cut between tokens so no secret is split in two.
  let text = value
  if (text.length > maxLength + MAX_TOKEN_LENGTH) {
    text = text.slice(0, maxLength + MAX_TOKEN_LENGTH)
    const lastSpace = text.search(/\s\S*$/)
    text = lastSpace === -1 ? text : text.slice(0, lastSpace)
  }
  const redacted = redactDiagnosticText(
    text.split(/(\s+)/).map(redactToken).join(''),
    Number.MAX_SAFE_INTEGER
  )
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

/** Redacts every string inside a value, at any depth. */
const redactDeep = (value: unknown, depth = 0): unknown => {
  if (typeof value === 'string') return redactText(value)
  if (!value || typeof value !== 'object') return value
  if (depth >= MAX_DEPTH) return '[max-depth]'
  if (Array.isArray(value)) return value.map(item => redactDeep(item, depth + 1))
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, redactDeep(item, depth + 1)])
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
  if (event.message) event.message = redactText(event.message)
  if (event.transaction) event.transaction = redactText(event.transaction)
  if (event.fingerprint) event.fingerprint = event.fingerprint.map(part => redactText(part))
  if (event.logentry) event.logentry = redactDeep(event.logentry) as ErrorEvent['logentry']
  if (event.tags) event.tags = redactDeep(event.tags) as ErrorEvent['tags']

  for (const exception of event.exception?.values ?? []) {
    if (exception.type) exception.type = redactText(exception.type)
    if (exception.value) exception.value = redactText(exception.value)
    if (exception.mechanism?.data) {
      exception.mechanism.data = redactDeep(
        exception.mechanism.data
      ) as typeof exception.mechanism.data
    }
    scrubFrames(exception.stacktrace?.frames)
  }
  for (const thread of event.threads?.values ?? []) scrubFrames(thread.stacktrace?.frames)

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs
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
