import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  COMMENTARY_SCHEMA,
  canonicalBookId,
  splitFrontmatter,
  splitStudyNote,
  verseNumbers,
} from '../build-cyberjudah-commentary.mjs'

const book = { id: 1, code: 'Gen', slug: 'genesis' }
const bible = { chapters: { 1: ['fixture', 'fixture', 'fixture'], 2: ['fixture', 'fixture'] } }
const parse = raw => splitStudyNote(raw, { file: 'docs/study/genesis/1.md', book, bible })

test('uses the shared approved book adapter without reassigning upstream Bible identities', () => {
  const mapping = JSON.parse(
    readFileSync(new URL('../../src/assets/cyberjudah/canonical-book-map.json', import.meta.url))
  )
  for (let id = 1; id <= 66; id++) assert.equal(canonicalBookId(id, mapping), id)
  assert.equal(canonicalBookId(67, mapping), 74)
  assert.equal(canonicalBookId(69, mapping), 67)
  assert.equal(canonicalBookId(71, mapping), 79)
  assert.throws(() => canonicalBookId(999, mapping))
})

test('preserves the complete source body and keeps nested/cross-book precepts with their section', () => {
  const raw = [
    '---',
    'title: "Fixture"',
    '---',
    '',
    '## Introduction',
    '',
    'Exact introduction.',
    '',
    '**[Genesis 1:1–2](/bible/genesis/1#v1)**',
    '',
    '- Exact words — “unchanged”.',
    '',
    '  Precepts:',
    '  - **[Exodus 2:1](/bible/exodus/2#v1)**',
    '',
    '    Exact nested text.',
    '',
    '**[Exodus 2:2](/bible/exodus/2#v2)**',
    '',
    'Exact cross-reference text.',
    '',
    '**[Genesis 1:3](/bible/genesis/1#v3)**',
    '',
    '- Last exact words.',
    '',
  ].join('\n')
  const { blocks } = parse(raw)
  assert.deepEqual(
    blocks.map(block => block.verses),
    [[0], [1, 2], [3]]
  )
  assert.equal(blocks.map(block => block.markdown).join(''), splitFrontmatter(raw).body)
  for (const block of blocks) assert.equal(raw.slice(block.start, block.end), block.markdown)
  assert.ok(blocks[1].markdown.includes('Exact cross-reference text.'))
  assert.ok(blocks[1].markdown.includes('/bible/exodus/2#v1'))
})

test('does not guess verse coverage for an unpartitioned chapter overview', () => {
  const result = parse('## Fixture overview\n\nExact complete source.\n')
  assert.equal(result.chapterOverviewOnly, true)
  assert.deepEqual(result.blocks[0].verses, [0])
})

test('uses the explicitly linked chapter within a multi-chapter study', () => {
  const result = splitStudyNote(
    [
      '**[Genesis 1:3](/bible/genesis/1#v3)**',
      'First exact source.',
      '**[Genesis 2:1-2](/bible/genesis/2#v1)**',
      'Second exact source.',
    ].join('\n'),
    { file: 'docs/study/genesis/1-2.md', book, bible }
  )
  assert.deepEqual(
    result.blocks.map(block => [block.chapter, block.verses]),
    [
      [1, [3]],
      [2, [1, 2]],
    ]
  )
})

test('keeps Greek Esther additions in their canonical book even inside the Esther source folder', () => {
  const raw = [
    '**[Esther 10:1-3](/bible/esther/10#v1)**',
    '',
    'Exact first source.',
    '',
    '**[Esther (Greek) 10:4-5](/bible/esther-greek/10#v4)**',
    '',
    'Exact second source.',
    '',
  ].join('\n')
  const result = splitStudyNote(raw, {
    file: 'docs/study/esther/10.md',
    book: { id: 17, slug: 'esther' },
    bible: { chapters: { 10: Array(3).fill('fixture') } },
    aliases: [
      {
        book: { id: 79, slug: 'esther-greek' },
        bible: { chapters: { 10: Array(13).fill('fixture') } },
      },
    ],
  })
  assert.deepEqual(
    result.blocks.map(block => [block.book, block.verses]),
    [
      [17, [1, 2, 3]],
      [79, [4, 5]],
    ]
  )
  assert.equal(result.blocks.map(block => block.markdown).join(''), raw)
})

test('recognizes a source reference even if its surrounding bold markup is unclosed', () => {
  const raw = '**[Genesis 1:2](/bible/genesis/1#v2)\n\nExact original.\n'
  assert.deepEqual(parse(raw).blocks[0].verses, [2])
  assert.equal(parse(raw).blocks[0].markdown, raw)
})

test('rejects invalid ranges rather than silently dropping or inventing verse associations', () => {
  assert.deepEqual(verseNumbers('1, 3–4, 4', 4), [1, 3, 4])
  for (const spec of ['0', '4-2', '1-9', '1:2-3', '1 and 2'])
    assert.throws(() => verseNumbers(spec, 4))
  assert.throws(() => parse('**[Genesis 1:4](/bible/genesis/1#v4)**\nOriginal.'))
})

test('keeps exact offsets with BOM, CRLF and frontmatter', () => {
  const raw = '\uFEFF---\r\ntitle: Fixture\r\n---\r\n\r\nExact source.\r\n'
  const result = parse(raw)
  const block = result.blocks[0]
  assert.equal(block.markdown, '\r\nExact source.\r\n')
  assert.equal(raw.slice(block.start, block.end), block.markdown)
})

test('normalized tables satisfy the unmodified chapter-reader query and enforce source associations', () => {
  const db = new DatabaseSync(':memory:')
  try {
    db.exec(COMMENTARY_SCHEMA)
    db.prepare('INSERT INTO COMMENTARY_DOCUMENTS VALUES (?,?)').run(
      'source:1',
      '<p>Exact source.</p>'
    )
    db.prepare('INSERT INTO COMMENTARY_VERSE_DOCUMENTS VALUES (?,?,?)').run('1-1-1', 0, 'source:1')
    const row = db
      .prepare(
        `SELECT links.verse_key, links.ordinal, documents.content
      FROM COMMENTARY_VERSE_DOCUMENTS links
      JOIN COMMENTARY_DOCUMENTS documents ON documents.id=links.document_id
      WHERE links.verse_key LIKE ? ORDER BY links.ordinal`
      )
      .get('1-1-%')
    assert.equal(row.content, '<p>Exact source.</p>')
    assert.equal(row.verse_key, '1-1-1')
    assert.throws(() =>
      db.prepare('INSERT INTO COMMENTARY_VERSE_DOCUMENTS VALUES (?,?,?)').run('1-1-2', 0, 'missing')
    )
    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok')
  } finally {
    db.close()
  }
})
