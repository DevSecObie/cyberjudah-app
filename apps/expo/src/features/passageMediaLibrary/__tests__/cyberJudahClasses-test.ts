/* eslint-disable import/first */

const mockStore = new Map<string, string>()
jest.mock('~helpers/storage', () => ({
  storage: {
    getString: (key: string) => mockStore.get(key),
    set: (key: string, value: string) => mockStore.set(key, value),
  },
}))

import {
  classNotesToBlocks,
  filterClassLibrary,
  getCachedClassById,
  loadClassLibrary,
  readCachedClassLibrary,
  toClassLibrary,
} from '../cyberJudahClasses'

const row = (videoId: string | null, date: string, extra: Record<string, unknown> = {}) => ({
  videoId,
  date,
  title: videoId ?? 'x',
  teacher: 'Bishop Nathanyel',
  url: `/classes/${date}`,
  ...extra,
})

const feeds = {
  classes: [
    row('sBoGbQK5zMA', '2026-10-24'),
    row('P4cR6i32U80', '2026-10-26', { allBooks: ['Genesis', 'Exodus'], topics: ['captivity'] }),
    row('TRUTH000001', '2026-10-20', {
      collection: 'The Truth Shall Make You Free · Kente FM Radio',
    }),
    row('POWERHOUR01', '2026-10-19', { collection: 'The Power Hour' }),
    row(null, '2026-10-27'),
  ],
  captains: [
    row('FQeCG3N9PZQ', '2026-10-26', { teacher: 'Captain Yaya' }),
    row('SENSE000001', '2026-10-21', { collection: 'Giving The Sense From A to Z' }),
  ],
  history: [row('FLSncKJFYss', '2026-10-25', { duration: 7594, teacher: 'Deacon Eythan' })],
}

const respond = (data: Record<string, unknown>) =>
  jest.fn(async (url: string) => ({
    ok: true,
    json: async () =>
      url.endsWith('/search/classes.json')
        ? data.classes
        : url.endsWith('/search/captains.json')
          ? data.captains
          : data.history,
  })) as unknown as typeof fetch

beforeEach(() => mockStore.clear())

describe('CyberJudah class library', () => {
  it('files classes with a video by collection in the Telegram order, newest first', () => {
    const library = toClassLibrary(feeds)
    expect(library.map(item => [item.series, item.providerId])).toEqual([
      ['Sabbath classes', 'P4cR6i32U80'],
      ['Sabbath classes', 'sBoGbQK5zMA'],
      ['15 Min w/ Captains', 'FQeCG3N9PZQ'],
      ['Our Hidden History', 'FLSncKJFYss'],
      ['Giving The Sense From A to Z', 'SENSE000001'],
      ['The Truth Shall Make You Free', 'TRUTH000001'],
      ['Shows', 'POWERHOUR01'],
    ])
    expect(library[3].durationSeconds).toBe(7594)
    expect(library[0].subtitle).toBe('2026-10-26 · Bishop Nathanyel')
    expect(library[6].subtitle).toBe('2026-10-19 · Bishop Nathanyel · The Power Hour')
  })

  it('searches titles, teachers, books and topics, and narrows by teacher and year', () => {
    const library = toClassLibrary(feeds)
    expect(
      filterClassLibrary(library, { query: 'exodus captivity' }).map(i => i.providerId)
    ).toEqual(['P4cR6i32U80'])
    expect(filterClassLibrary(library, { teacher: 'Captain Yaya' }).map(i => i.providerId)).toEqual(
      ['FQeCG3N9PZQ']
    )
    expect(filterClassLibrary(library, { series: 'Shows', year: '2026' })).toHaveLength(1)
    expect(filterClassLibrary(library, { year: '2025' })).toHaveLength(0)
  })

  it('shows a newly published class without an app update and keeps it for offline', async () => {
    const published = { ...feeds, classes: [...feeds.classes, row('NEWCLASS123', '2026-10-30')] }
    const library = await loadClassLibrary(respond(published))
    expect(library[0].providerId).toBe('NEWCLASS123')
    expect(readCachedClassLibrary()?.[0].providerId).toBe('NEWCLASS123')
    expect(getCachedClassById('cyberjudah-class-NEWCLASS123')?.title).toBe('NEWCLASS123')
  })

  it('keeps the last list when the classes cannot be read', async () => {
    await loadClassLibrary(respond(feeds))
    const failing = jest.fn(async () => ({ ok: false, status: 503 })) as unknown as typeof fetch
    await expect(loadClassLibrary(failing)).rejects.toThrow('CYBERJUDAH_CLASSES_UNAVAILABLE:503')
    expect(readCachedClassLibrary()).toHaveLength(7)
  })
})

describe('classNotesToBlocks', () => {
  it('reads the notes into the blocks the app draws', () => {
    const blocks = classNotesToBlocks(
      [
        '## Scriptures Opened',
        '',
        'The **first** point, at *[[10:04](https://www.youtube.com/watch?v=P4cR6i32U80&t=604s)]*.',
        '',
        'Precepts:',
        '',
        '- A precept',
        '  - Under it',
        '',
        '---',
        '[Class Notes Index](/classes)',
      ].join('\n'),
      'P4cR6i32U80'
    )
    expect(blocks.map(block => block.type)).toEqual([
      'heading',
      'paragraph',
      'paragraph',
      'list',
      'rule',
    ])
    expect(blocks[1]).toMatchObject({
      type: 'paragraph',
      html: expect.stringContaining('<a class="ts" href="cyberjudah-seek:604">10:04</a>'),
    })
    expect(blocks[2]).toEqual({ type: 'paragraph', html: 'Precepts', variant: 'label' })
    expect(blocks[3]).toMatchObject({
      type: 'list',
      items: [[{ type: 'paragraph' }, { type: 'list' }]],
    })
  })
})

describe('In the News', () => {
  it('moves each timed item out of its own section into Scriptures Opened', () => {
    const seek = (t: number) => `*[[0:${t}](https://www.youtube.com/watch?v=P4cR6i32U80&t=${t}s)]*`
    const blocks = classNotesToBlocks(
      [
        '## In The News',
        '',
        `- ${seek(30)} **A news report**`,
        '- A report with no moment',
        '',
        '## Scriptures Opened',
        '',
        'A point.',
        '',
        '## In Closing',
      ].join('\n'),
      'P4cR6i32U80'
    )
    expect(blocks.map(block => block.type)).toEqual([
      'heading',
      'list',
      'heading',
      'paragraph',
      'aside',
      'heading',
    ])
    expect(blocks[1]).toMatchObject({ items: [[{ html: 'A report with no moment' }]] })
    expect(blocks[4]).toMatchObject({
      type: 'aside',
      label: 'In the News',
      blocks: [{ html: expect.stringContaining('A news report') }],
    })
  })
})
