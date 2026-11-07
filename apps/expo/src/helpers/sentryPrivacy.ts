import type { Breadcrumb, ErrorEvent, ReactNativeOptions } from '@sentry/react-native'

import { redactDiagnosticText, sanitizeDiagnosticPayload } from './agentObservability'

// CyberJudah sends crash reports to its own GlitchTip (errors.cyberjudah.io). These hooks keep
// readers' data out of them: no user details beyond the account id, no request headers or bodies, no query string or fragment
// in any URL (they can hold search text, tokens or ids), no console output, no touch labels, and
// emails, bearer tokens and JWTs redacted from free text. GlitchTip scrubs again on arrival and
// stores no IP address (ask-cyberjudah-monitoring: ingest-proxy and GLITCHTIP_PII_SCRUB_DEFAULT).

type EventHint = Parameters<NonNullable<ReactNativeOptions['beforeSend']>>[1]
type EventHook = (event: ErrorEvent, hint: EventHint) => ErrorEvent | null

const MAX_TEXT_LENGTH = 8_000
// `scheme://host/path?query#hash` and `/path?query#hash`: keep everything before `?` or `#`.
const ABSOLUTE_URL_QUERY = /(\b[a-z][a-z0-9+.-]*:\/\/[^\s?#"'<>]*)[?#][^\s"'<>]*/gi
const PATH_QUERY = /(^|[\s("'=])(\/[^\s?#"'<>]*)[?#][^\s"'<>]*/g

export const redactText = (value: string, maxLength = MAX_TEXT_LENGTH) =>
  redactDiagnosticText(
    value.replace(ABSOLUTE_URL_QUERY, '$1').replace(PATH_QUERY, '$1$2'),
    maxLength
  )

const redactValue = (value: unknown) => (typeof value === 'string' ? redactText(value) : value)

// Our own breadcrumbs (appLogger and the Redux logger) are sanitized where they are written.
const isOwnBreadcrumb = (category = '') =>
  category === 'Dispatch' || category.startsWith('bible-strong.')

export const scrubSentryBreadcrumb = (breadcrumb: Breadcrumb): Breadcrumb | null => {
  // Console output can hold anything the app or a library logged.
  if (breadcrumb.category === 'console') return null

  const scrubbed: Breadcrumb = { ...breadcrumb }
  if (scrubbed.message) scrubbed.message = redactText(scrubbed.message)

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

  if (scrubbed.data && !isOwnBreadcrumb(breadcrumb.category)) {
    const data = sanitizeDiagnosticPayload(scrubbed.data) ?? {}
    scrubbed.data = Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, redactValue(value)])
    )
  }
  return scrubbed
}

// Contexts the SDK fills with device and app facts; any other context is ours and is sanitized.
const SDK_CONTEXTS = new Set([
  'app',
  'device',
  'os',
  'runtime',
  'culture',
  'trace',
  'react_native_context',
  'expo_updates',
  'expo_constants',
  'expo_device',
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
  if (event.logentry) {
    event.logentry = {
      ...event.logentry,
      message: event.logentry.message && redactText(event.logentry.message),
      params: event.logentry.params?.map(redactValue),
    }
  }

  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = redactText(exception.value)
    for (const frame of exception.stacktrace?.frames ?? []) {
      delete frame.vars
      if (frame.filename) frame.filename = redactText(frame.filename)
      if (frame.abs_path) frame.abs_path = redactText(frame.abs_path)
    }
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs
      .map(scrubSentryBreadcrumb)
      .filter((breadcrumb): breadcrumb is Breadcrumb => breadcrumb !== null)
  }

  if (event.extra) event.extra = sanitizeDiagnosticPayload(event.extra)

  if (event.contexts) {
    for (const [name, context] of Object.entries(event.contexts)) {
      if (!context || SDK_CONTEXTS.has(name)) continue
      event.contexts[name] = sanitizeDiagnosticPayload(context)
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
