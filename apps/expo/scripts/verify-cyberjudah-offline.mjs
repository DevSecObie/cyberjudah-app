import assert from 'node:assert/strict'
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { validateStrongBibleSidecarSnapshot } from '../src/helpers/strongBibleSidecarValidation.ts'
const app = resolve(import.meta.dirname, '..')
const catalog = JSON.parse(
  await readFile(join(app, 'src/assets/cyberjudah/offline-catalog.json'), 'utf8')
)
const books = JSON.parse(await readFile(join(app, 'src/assets/cyberjudah/books.json'), 'utf8'))
const publication = JSON.parse(
  await readFile(join(app, 'src/assets/cyberjudah/publication.json'), 'utf8')
)
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const temp = await mkdtemp(join(tmpdir(), 'cyberjudah-offline-'))
try {
  let bible
  for (const entry of Object.values(catalog.resources)) {
    const path = join(app, 'public/offline', entry.file),
      bytes = await readFile(path)
    assert.equal(hash(bytes), entry.archiveSha256)
    assert.equal(bytes.length, entry.archiveBytes)
    const content = execFileSync(
      'python3',
      [
        '-c',
        'import zipfile,sys; sys.stdout.buffer.write(zipfile.ZipFile(sys.argv[1]).read(sys.argv[2]))',
        path,
        entry.entry,
      ],
      { maxBuffer: 256 * 1024 * 1024 }
    )
    assert.equal(hash(content), entry.contentSha256)
    assert.equal(content.length, entry.contentBytes)
    await writeFile(join(temp, entry.entry), content)
    if (entry.id === 'bible:KJV') bible = JSON.parse(content)
    if (entry.id === 'database:TIMELINE:en' || entry.id === 'database:TIMELINE:fr') {
      const events = JSON.parse(content)
      const geometry = JSON.parse(
        await readFile(join(app, 'src/assets/cyberjudah/timeline-sections.json'), 'utf8')
      )
      const timeline = JSON.parse(
        await readFile(join(app, 'src/assets/cyberjudah/timeline-publication.json'), 'utf8')
      )
      assert.equal(events.length, timeline.readableEvents)
      assert.equal(new Set(events.map(event => event.slug)).size, events.length)
      assert.equal(`cj-timeline-${hash(JSON.stringify({ geometry, events }))}`, timeline.revision)
      for (const event of events) {
        assert.ok(geometry.some(section => section.events.some(row => row.slug === event.slug)))
        assert.equal(typeof event.article, 'string')
        assert.ok(Array.isArray(event.scriptures))
      }
    }
  }
  assert.equal(bible.schemaVersion, 4)
  assert.equal(bible.datasetId, 'CYBERJUDAH')
  assert.equal(Object.keys(bible.verses).length, 81)
  let verses = 0,
    chapters = 0
  for (const book of books) {
    assert.deepEqual(Object.keys(bible.verses[book.id]).map(Number), book.chapters)
    for (const chapter of book.chapters) {
      const rows = Object.entries(bible.verses[book.id][chapter]).map(([v, data]) => [
        Number(v),
        data.text,
      ])
      assert.equal(hash(JSON.stringify(rows)), publication.chapterHashes[`${book.id}-${chapter}`])
      verses += rows.length
      chapters++
    }
  }
  assert.equal(verses, bible.verseCount)
  const db = new DatabaseSync(join(temp, 'bible-kjv-strong.sqlite'), { readOnly: true })
  const metadata = Object.fromEntries(
    db
      .prepare('SELECT key,value FROM ResourceMetadata')
      .all()
      .map(r => [r.key, r.value])
  )
  metadata.schemaVersion = Number(metadata.schemaVersion)
  const tables = [
    'Verses',
    'WordSpans',
    'StrongCodes',
    'WordStrongCodes',
    'FrenchLexemes',
    'WordStepTokenExtras',
  ]
  const tableColumns = Object.fromEntries(
    tables.map(t => [
      t,
      db
        .prepare(`PRAGMA table_info(${t})`)
        .all()
        .map(r => r.name),
    ])
  )
  const indexes = Object.fromEntries(
    tables.map(t => [
      t,
      db
        .prepare(`PRAGMA index_list(${t})`)
        .all()
        .map(r =>
          db
            .prepare(`PRAGMA index_info(${r.name})`)
            .all()
            .map(c => c.name)
        ),
    ])
  )
  const count = (table, where = '') =>
    Number(db.prepare(`SELECT COUNT(*) AS n FROM ${table} ${where}`).get().n)
  const counts = {
    verseCount: count('Verses'),
    occurrenceCount: count('WordSpans'),
    unalignedOccurrenceCount: count('WordSpans', 'WHERE isAligned=0'),
    identityCount: count('WordStrongCodes'),
    lexemeAssignmentCount: count('WordSpans', 'WHERE lexemeId IS NOT NULL'),
    lexemeCount: count('FrenchLexemes'),
  }
  validateStrongBibleSidecarSnapshot(
    {
      integrity: db.prepare('PRAGMA integrity_check').get().integrity_check,
      metadata,
      counts,
      tableColumns,
      indexes,
    },
    { ...metadata, ...counts, schemaVersion: 4 }
  )
  assert.equal(metadata.textSha256, bible.textSha256)
  assert.equal(counts.verseCount, verses)
  const john = db
    .prepare(
      'SELECT w.startOffset,w.length,c.code FROM Verses v JOIN WordSpans w ON w.verseId=v.id JOIN WordStrongCodes wc ON wc.verseId=w.verseId AND wc.ordinal=w.ordinal JOIN StrongCodes c ON c.id=wc.codeId WHERE v.bookOrder=43 AND v.chapter=3 AND v.verse=16 AND c.code=?'
    )
    .get('G2316')
  assert.equal(
    bible.verses[43][3][16].text.slice(john.startOffset, john.startOffset + john.length),
    'God'
  )
  db.close()
  console.log(
    JSON.stringify({
      books: 81,
      chapters,
      verses,
      strongSpans: counts.occurrenceCount,
      archiveIntegrity: 'verified',
      strongSchema: 'verified',
      john316Alignment: 'verified',
    })
  )
} finally {
  await rm(temp, { recursive: true, force: true })
}
