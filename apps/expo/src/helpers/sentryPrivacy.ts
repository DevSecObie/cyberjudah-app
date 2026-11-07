import type { Breadcrumb, ErrorEvent, ReactNativeOptions } from '@sentry/react-native'

import { redactDiagnosticText, sanitizeDiagnosticPayload } from './agentObservability'

// CyberJudah sends crash reports to its own GlitchTip (errors.cyberjudah.io). These hooks keep
// readers' data out of them: no user details beyond the account id, no request headers or
// bodies, no query string or fragment in any URL (they can hold search text, tokens or ids), no
// password in a URL, no console output, no element labels, no device name, and emails, bearer
// tokens and JWTs redacted from every free-text field. GlitchTip scrubs again on arrival and
// stores no IP address (ask-cyberjudah-monitoring: ingest-proxy and GLITCHTIP_PII_SCRUB_DEFAULT).
// Hard native crashes are sent by the native SDK and skip these hooks: RootLayout.native.tsx
// turns off the native breadcrumbs, and FireAuth sets nothing but the account id.

type EventHint = Parameters<NonNullable<ReactNativeOptions['beforeSend']>>[1]
type EventHook = (event: ErrorEvent, hint: EventHint) => ErrorEvent | null

const MAX_TEXT_LENGTH = 8_000
const MAX_DEPTH = 6
// `scheme://user:password@host`: the credentials go, the host stays.
const URL_CREDENTIALS = /(\b[a-z][a-z0-9+.-]*:\/\/)[^\s/?#@"'<>]+@/gi
// Anything with a `/` (`https://host/path`, `host/path`, `api/search`, `/notes`) followed by
// `?query` or `#hash`: keep what comes before. Not a regex the RN URL polyfill gap can break.
const URL_QUERY = /([^\s?#"'<>()[\]{}]*\/[^\s?#"'<>()[\]{}]*)[?#][^\s"'<>()[\]{}]*/g
// Web click and input breadcrumbs describe the element as a CSS selector whose attributes carry
// aria-label (React Native Web's accessibilityLabel), title or alt text.
const SELECTOR_ATTRIBUTES = /\[[^\]]*\]/g

export const redactText = (value: string, maxLength = MAX_TEXT_LENGTH) =>
  redactDiagnosticText(
    value.replace(URL_CREDENTIALS, '$1[REDACTED]@').replace(URL_QUERY, '$1'),
    maxLength
  )

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
    if (scrubbed.message)
      scrubbed.message = redactText(scrubbed.message.replace(SELECTOR_ATTRIBUTES, ''))
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
