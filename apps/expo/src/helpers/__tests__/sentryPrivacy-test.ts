import type { Breadcrumb, ErrorEvent } from '@sentry/react-native'

import {
  redactText,
  scrubSentryBreadcrumb,
  scrubSentryEvent,
  stripSelectorAttributes,
  withPrivacy,
} from '../sentryPrivacy'

jest.mock('@sentry/react-native', () => ({ addBreadcrumb: jest.fn(), withScope: jest.fn() }))

const event = (overrides: Partial<ErrorEvent> = {}): ErrorEvent => ({
  type: undefined,
  level: 'error',
  ...overrides,
})

describe('redactText', () => {
  // After a cut query the rest of the line goes too (a search can hold spaces).
  it('drops query strings and fragments from URLs and paths', () => {
    expect(
      redactText(
        'GET https://cyberjudah.io/api/search?q=private+words#top failed; see /notes/42?token=abc'
      )
    ).toBe('GET https://cyberjudah.io/api/search')
    expect(redactText('cyberjudah://verse?ref=JHN.3.16 opened')).toBe('cyberjudah://verse')
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
    expect(exception?.value).toBe('GET https://cyberjudah.io/x')
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

describe('review cases', () => {
  it('strips queries from scheme-less hosts and relative paths, without eating what follows', () => {
    expect(redactText('fetch failed: cyberjudah.io/api/search?q=private words')).toBe(
      'fetch failed: cyberjudah.io/api/search'
    )
    expect(redactText('GET api/search?q=secret')).toBe('GET api/search')
    expect(redactText('path:/notes?id=42')).toBe('path:/notes')
    // Privacy over detail: text glued to a query goes with it.
    expect(redactText('load(https://x/a?b=1),retry=3 failed')).toBe('load(https://x/a')
  })

  it('removes passwords from URLs', () => {
    expect(redactText('connect https://admin:s3cret@localhost:8080/db failed')).toBe(
      'connect https://[REDACTED]@localhost:8080/db failed'
    )
  })

  it('drops element attributes (aria-label) from web click and input breadcrumbs', () => {
    expect(
      scrubSentryBreadcrumb({
        category: 'ui.click',
        message: 'div.css-1x > div[aria-label="My prayer list"]',
        data: { label: 'My prayer list' },
      })
    ).toEqual({ category: 'ui.click', message: 'div.css-1x > div' })
  })

  it('strips queries nested anywhere in breadcrumb data, extra and contexts', () => {
    const scrubbed = scrubSentryEvent(
      event({
        breadcrumbs: [
          { category: 'bible-strong.download', data: { request: { link: 'https://h/a?token=1' } } },
        ],
        extra: { attempt: { link: 'https://h/b?token=2' } },
        contexts: { diagnostic: { url: 'https://h/c?token=3', nested: { href: '/d?token=4' } } },
      })
    )
    expect(JSON.stringify(scrubbed)).not.toMatch(/token=/)
  })

  it('scrubs tags, transaction, fingerprint, exception type, mechanism data and threads', () => {
    const scrubbed = scrubSentryEvent(
      event({
        tags: { link: 'https://h/a?q=secret' },
        transaction: '/search?q=secret',
        fingerprint: ['reader@example.com'],
        exception: {
          values: [
            {
              type: 'Error for reader@example.com',
              mechanism: { type: 'generic', data: { url: 'https://h/b?q=secret' } },
            },
          ],
        },
        threads: {
          values: [{ stacktrace: { frames: [{ filename: '/app.js?q=secret', vars: {} }] } }],
        },
      })
    )
    expect(JSON.stringify(scrubbed)).not.toMatch(/secret|reader@/)
    expect(scrubbed.threads?.values?.[0]?.stacktrace?.frames?.[0]).toEqual({ filename: '/app.js' })
  })

  it('keeps SDK and diagnostic contexts whole (no key redaction, no 500-char cut)', () => {
    const componentStack = 'in View\n'.repeat(200)
    const scrubbed = scrubSentryEvent(
      event({ contexts: { react: { componentStack }, diagnostic: { stateName: 'ready' } } })
    )
    expect(scrubbed.contexts?.react?.componentStack).toBe(componentStack)
    expect(scrubbed.contexts?.diagnostic).toEqual({ stateName: 'ready' })
  })
})

describe('second review cases', () => {
  it('drops the whole query, whatever brackets, quotes or parens it holds', () => {
    for (const url of [
      'https://x/a?ids=[1,2]&token=abc',
      'https://x/a?q=hello(world)&token=abc',
      'https://x/a?f={"a":1}&token=abc',
      "https://x/a?q=it's&token=abc",
      'https://x/wiki/Foo_(bar)?token=abc',
    ]) {
      expect(redactText(`GET ${url} failed`)).not.toMatch(/token|world|hello|it's|ids/)
    }
  })

  it('removes the whole password, even with @ or / in it', () => {
    expect(redactText('https://u:p@ss@host/x')).toBe('https://[REDACTED]@host/x')
    expect(redactText('https://admin:pa/ss@localhost/db')).toBe('https://[REDACTED]@localhost/db')
    expect(redactText('https://x/users/@me')).toBe('https://x/users/@me')
  })

  it('leaves ordinary text and keeps stack locations', () => {
    expect(redactText('Is it read/write? Why? #1')).toBe('Is it read/write? Why? #1')
    expect(redactText('at foo (http://x/a.js?v=1:10:5)')).toBe('at foo (http://x/a.js:10:5')
  })

  it('strips selector attributes with ] or quotes inside, and unterminated ones', () => {
    expect(
      stripSelectorAttributes('div > div[aria-label="Note [1] on Psalm 23 my secret"].x')
    ).toBe('div > div.x')
    expect(stripSelectorAttributes('a[title="open')).toBe('a')
  })

  it('replaces long runs, which also bounds the cost of every pattern', () => {
    expect(redactText(`blob ${'ab/cd+ef/'.repeat(30)} end`)).toBe('blob [270 chars] end')
    const started = Date.now()
    for (const input of [
      'data:image/png;base64,' + 'ab/cd+ef/'.repeat(20_000),
      '.a'.repeat(20_000),
      '-eyJ'.repeat(20_000),
      'x.y '.repeat(20_000),
    ]) {
      redactText(input)
    }
    // Generous on purpose: it guards against seconds of backtracking, not milliseconds.
    expect(Date.now() - started).toBeLessThan(1_000)
  })
})

describe('third review cases', () => {
  it('finds credentials after an earlier # or ? in the same JSON token', () => {
    // The `#1` inside the token already cuts the rest of it: over-redaction, never a leak.
    expect(redactText('{"tag":"#1","url":"https://admin:hunter2@localhost/x"}')).not.toMatch(
      /hunter2|admin/
    )
    expect(redactText('{"url":"https://admin:hunter2@localhost/x"}')).toBe(
      '{"url":"https://[REDACTED]@localhost/x"}'
    )
  })

  it('removes passwords holding ? or #, token-only userinfo, and keeps ports and @ paths', () => {
    expect(redactText('https://u:p?ss@host/x')).toBe('https://[REDACTED]')
    expect(redactText('https://u:p#ss@host/x')).toBe('https://[REDACTED]')
    expect(redactText('https://ghp_secret@localhost/x')).toBe('https://[REDACTED]@localhost/x')
    // Errs on the side of redacting: a port followed by an @ in the path reads like a password.
    expect(redactText('https://x:8080/users/@me')).toBe('https://[REDACTED]@me')
  })

  it('keeps a :line:col only on script files, never from a query value', () => {
    expect(redactText('GET https://x/a?time=12:30')).toBe('GET https://x/a')
    expect(redactText('GET https://x/a?pin=1234:5678:9')).toBe('GET https://x/a')
    expect(redactText('at f (https://x/app.bundle?platform=ios:12:7)')).toBe(
      'at f (https://x/app.bundle:12:7'
    )
  })

  it('cuts queries without a slash or scheme', () => {
    expect(redactText('search?q=secret')).toBe('search')
    expect(redactText('mailto:me@x.com?subject=private')).not.toMatch(/private|me@x/)
  })

  it('never leaves half a secret at the length limit', () => {
    for (const secret of ['https://user:password@h/x', 'me@example.com']) {
      // The first padding ends at the final cut, the second where the scan itself is cut.
      for (const padding of ['x '.repeat(3_998), 'x '.repeat(4_093)]) {
        expect(redactText(`${padding}${secret} tail`)).not.toMatch(/password|me@e|user/)
      }
    }
  })
})

describe('fourth review cases', () => {
  it('cuts a query on a URL with no path, even with an @ in it', () => {
    expect(redactText('https://host?email=me@x.com&q=mysearchtext')).toBe('https://host')
    expect(redactText('https://host?search=prayer@home&token=abc')).toBe('https://host')
  })

  it('handles URLs joined by a comma, | or brackets one by one', () => {
    for (const text of [
      'ALLOWED=https://cdn.x/a,https://admin:hunter2@db.x/y',
      '(https://cdn.x/a)(https://admin:hunter2@db.x/y)',
      'https://cdn.x/a|https://admin:hunter2@db.x/y',
    ]) {
      expect(redactText(text)).not.toMatch(/hunter2|admin/)
    }
  })

  it('cuts every query-like ? or #, not only the first one', () => {
    expect(redactText('{"tag":"#1","path":"/search?q=secret"}')).not.toMatch(/secret/)
    expect(redactText('{"hash":"#access_token=ya29SECRET&x=1"}')).not.toMatch(/SECRET/)
    expect(redactText('?q=secretsearch')).toBe('')
    expect(redactText('#access_token=ya29.SECRET&token_type=bearer')).toBe('')
    expect(redactText('/notes?mysecretterm')).toBe('/notes')
  })

  it('removes a password that starts with digits and holds a /', () => {
    expect(redactText('https://admin:2024/pw@db.x/y')).toBe('https://[REDACTED]@db.x/y')
  })
})

describe('fifth review cases', () => {
  it('removes passwords holding a / and an = or &', () => {
    for (const text of [
      'https://user:abc/def==@db.example.com/x',
      'postgres://admin:s3cr=t/x@db:5432/app',
      'https://user:p&ss/w@host/x',
    ]) {
      expect(redactText(text)).not.toMatch(/abc|def|s3cr|p&ss|admin|user/)
    }
  })

  it('cuts a fragment or query right after a URL that ended at a bracket, comma or |', () => {
    expect(redactText('https://en.wikipedia.org/wiki/Foo_(bar)#my-secret-note')).not.toMatch(
      /secret/
    )
    expect(redactText('https://x.io/notes,abc#prayer-for-son')).not.toMatch(/prayer/)
    expect(redactText('https://x.io/notes|search?prayer')).not.toMatch(/prayer/)
  })

  it('drops the rest of the line after a cut query, so searches with spaces go whole', () => {
    expect(redactText('Failed https://api.x.io/search?q=pray for my mother\nnext line')).toBe(
      'Failed https://api.x.io/search\nnext line'
    )
    expect(redactText('search?q=pray for my mother')).toBe('search')
  })

  it('cuts a ? or # inside a word, keeps Why? and #1', () => {
    expect(redactText('search?prayer')).toBe('search')
    expect(redactText('notes#prayer-for-son')).toBe('notes')
    expect(redactText('Why? #1 C#')).toBe('Why? #1 C#')
  })

  it('redacts Basic credentials, secret assignments and quoted JSON secrets', () => {
    expect(redactText('Authorization: Basic dXNlcjpwYXNzd29yZA==')).toBe(
      'Authorization: Basic [REDACTED]'
    )
    expect(redactText('refresh_token=AMf-vBxSecretRefresh123')).toBe('refresh_token=[REDACTED]')
    expect(
      redactText('{"password":"hunter2","refreshToken":"AMf-vBxSecret","count":3}')
    ).not.toMatch(/hunter2|AMf/)
    expect(redactText('AuthError: Network request failed')).toBe(
      'AuthError: Network request failed'
    )
  })

  it('redacts non-ASCII email addresses', () => {
    expect(redactText('sent to josé@exemple.fr')).toBe('sent to [REDACTED_EMAIL]')
  })

  it('redacts search keys in extra, tags and contexts', () => {
    const scrubbed = scrubSentryEvent(
      event({
        extra: { query: 'pray for my mother', term: 'adultery', count: 2 },
        tags: { searchTerm: 'my secret', feature: 'search' },
        contexts: { diagnostic: { q: 'secret words' } },
      })
    )
    expect(JSON.stringify(scrubbed)).not.toMatch(/pray|adultery|my secret|secret words/)
    expect(scrubbed.extra?.count).toBe(2)
    expect(scrubbed.tags?.feature).toBe('search')
  })
})
