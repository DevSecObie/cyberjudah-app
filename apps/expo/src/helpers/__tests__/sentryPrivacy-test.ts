import type { Breadcrumb, ErrorEvent } from '@sentry/react-native'

import { redactText, scrubSentryBreadcrumb, scrubSentryEvent, withPrivacy } from '../sentryPrivacy'

jest.mock('@sentry/react-native', () => ({ addBreadcrumb: jest.fn(), withScope: jest.fn() }))

const event = (overrides: Partial<ErrorEvent> = {}): ErrorEvent => ({
  type: undefined,
  level: 'error',
  ...overrides,
})

describe('redactText', () => {
  it('drops query strings and fragments from URLs and paths, keeps the rest', () => {
    expect(
      redactText(
        'GET https://cyberjudah.io/api/search?q=private+words#top failed; see /notes/42?token=abc'
      )
    ).toBe('GET https://cyberjudah.io/api/search failed; see /notes/42')
    expect(redactText('cyberjudah://verse?ref=JHN.3.16 opened')).toBe('cyberjudah://verse opened')
    expect(redactText('Why? Because #1 matters')).toBe('Why? Because #1 matters')
  })

  it('redacts emails, bearer tokens and JWTs', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl'
    const text = redactText(`for reader@example.com with Bearer abc.def and ${jwt}`)
    expect(text).not.toMatch(/reader@example\.com|abc\.def|eyJ/)
  })
})

describe('scrubSentryBreadcrumb', () => {
  it('drops console output', () => {
    expect(scrubSentryBreadcrumb({ category: 'console', message: 'my note: …' })).toBeNull()
  })

  it('keeps only component names on touches', () => {
    const touch: Breadcrumb = {
      category: 'touch',
      message: 'Touch event within element: My prayer list',
      data: { path: [{ name: 'Button', label: 'My prayer list', file: 'Notes.tsx' }] },
    }
    expect(scrubSentryBreadcrumb(touch)).toEqual({
      category: 'touch',
      message: 'Touch event',
      data: { path: [{ name: 'Button' }] },
    })
  })

  it('strips query strings from SDK request and navigation breadcrumbs', () => {
    const scrubbed = scrubSentryBreadcrumb({
      category: 'fetch',
      data: { url: 'https://cyberjudah.io/api/search?q=secret', method: 'GET', status_code: 200 },
    })
    expect(scrubbed?.data).toEqual({
      url: 'https://cyberjudah.io/api/search',
      method: 'GET',
      status_code: 200,
    })
    expect(
      scrubSentryBreadcrumb({ category: 'navigation', data: { from: '/a?x=1', to: '/b#y' } })?.data
    ).toEqual({ from: '/a', to: '/b' })
  })

  it('leaves our own breadcrumbs as written (they are sanitized at the source)', () => {
    const dispatch = {
      category: 'Dispatch',
      message: 'notes/add',
      data: { payload: { type: 'object', keys: ['id'] } },
    }
    expect(scrubSentryBreadcrumb(dispatch)).toEqual(dispatch)
  })
})

describe('scrubSentryEvent', () => {
  it('keeps only the account id, and no request details', () => {
    const scrubbed = scrubSentryEvent(
      event({
        user: {
          id: 'uid-1',
          email: 'reader@example.com',
          username: 'Sarah',
          ip_address: '{{auto}}',
        },
        request: {
          url: 'https://cyberjudah.io/read?verse=1#x',
          headers: { Cookie: 'session=1' },
          data: 'body',
          query_string: 'verse=1',
        },
        server_name: 'Sarahs-iPhone',
      })
    )
    expect(scrubbed.user).toEqual({ id: 'uid-1' })
    expect(scrubbed.request).toEqual({ url: 'https://cyberjudah.io/read' })
    expect(scrubbed.server_name).toBeUndefined()
    expect(scrubSentryEvent(event({ user: { email: 'a@b.co' } })).user).toBeUndefined()
  })

  it('redacts messages, exception values, frames, breadcrumbs, extra and our contexts', () => {
    const scrubbed = scrubSentryEvent(
      event({
        message: 'failed for reader@example.com',
        exception: {
          values: [
            {
              type: 'Error',
              value: 'GET https://cyberjudah.io/x?token=1 failed',
              stacktrace: {
                frames: [{ filename: 'https://cyberjudah.io/app.js?v=1', vars: { note: 'x' } }],
              },
            },
          ],
        },
        breadcrumbs: [
          { category: 'console', message: 'secret' },
          { category: 'ui', message: 'ok' },
        ],
        extra: { note: 'private text', count: 2 },
        contexts: {
          device: { name: "Sarah's iPhone", model: 'iPhone16,1' },
          os: { name: 'iOS', version: '19.1' },
          export: { noteTitle: 'Private title', email: 'reader@example.com' },
        },
      })
    )
    expect(scrubbed.message).toBe('failed for [REDACTED_EMAIL]')
    const exception = scrubbed.exception?.values?.[0]
    expect(exception?.value).toBe('GET https://cyberjudah.io/x failed')
    expect(exception?.stacktrace?.frames?.[0]).toEqual({ filename: 'https://cyberjudah.io/app.js' })
    expect(scrubbed.breadcrumbs).toEqual([{ category: 'ui', message: 'ok' }])
    expect(scrubbed.extra).toEqual({ note: '[REDACTED]', count: 2 })
    expect(scrubbed.contexts?.device).toEqual({ model: 'iPhone16,1' })
    expect(scrubbed.contexts?.os).toEqual({ name: 'iOS', version: '19.1' })
    expect(JSON.stringify(scrubbed.contexts?.export)).not.toMatch(/Private title|reader@/)
  })
})

describe('withPrivacy', () => {
  it('filters on the raw event, then scrubs what is kept', () => {
    const seen: string[] = []
    const hook = withPrivacy(e => {
      seen.push(e.message ?? '')
      return e.message?.includes('drop') ? null : e
    })
    expect(hook(event({ message: 'drop me' }), {})).toBeNull()
    expect(hook(event({ message: 'keep reader@example.com' }), {})?.message).toBe(
      'keep [REDACTED_EMAIL]'
    )
    expect(seen).toEqual(['drop me', 'keep reader@example.com'])
  })
})
