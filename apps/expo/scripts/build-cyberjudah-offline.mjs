// Build the existing Bible Strong offline formats from the exact published CyberJudah text.
// No text, Strong alignment or missing original-language tokens are invented.
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { join, resolve } from 'node:path'
import { execFile, execFileSync } from 'node:child_process'
import { promisify } from 'node:util'
const runFile = promisify(execFile)
const app = resolve(import.meta.dirname, '..')
const books = JSON.parse(await readFile(join(app, 'src/assets/cyberjudah/books.json'), 'utf8'))
const metadata = JSON.parse(
  await readFile(join(app, 'src/assets/cyberjudah/publication.json'), 'utf8')
)
const cache = resolve(process.argv[2] ?? join(app, '.cyberjudah-chapters'))
const output = join(app, 'public/offline')
await mkdir(cache, { recursive: true })
await mkdir(output, { recursive: true })
const hash = data =>
  createHash('sha256')
    .update(typeof data === 'string' || data instanceof Uint8Array ? data : JSON.stringify(data))
    .digest('hex')
const tasks = books.flatMap(book => book.chapters.map(chapter => ({ book, chapter })))
let cursor = 0,
  complete = 0
const chapters = new Map()
async function download({ book, chapter }) {
  const path = join(cache, `${book.id}-${chapter}.json`)
  let data
  try {
    data = JSON.parse(await readFile(path, 'utf8'))
  } catch {}
  if (!data) {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const { stdout } = await runFile(
          'curl',
          [
            '--http1.1',
            '--fail',
            '--silent',
            '--show-error',
            '--max-time',
            '30',
            `https://data.cyberjudah.io/api/kjv/${book.slug}/${chapter}.json`,
          ],
          { maxBuffer: 8 * 1024 * 1024 }
        )
        data = JSON.parse(stdout)
        break
      } catch {
        if (attempt === 4) throw new Error(`Chapter download failed: ${book.slug}/${chapter}`)
      }
    }
    await writeFile(path, JSON.stringify(data))
  }
  const key = `${book.id}-${chapter}`
  if (
    data.translation !== 'KJV' ||
    data.chapter !== chapter ||
    hash(data.verses.map(v => [v.verse, v.text])) !== metadata.chapterHashes[key] ||
    hash(data.verses.map(v => [v.verse, v.text, v.words ?? []])) !==
      metadata.strongChapterHashes[key]
  )
    throw new Error(`Publication mismatch: ${key}`)
  chapters.set(key, data)
  if (++complete % 100 === 0) console.log(`Verified ${complete}/${tasks.length} published chapters`)
}
await Promise.all(
  Array.from({ length: 8 }, async () => {
    while (cursor < tasks.length) await download(tasks[cursor++])
  })
)
const text = {
  format: 'bible-strong-canonical-bible',
  schemaVersion: 4,
  applicationVersionId: 'KJV',
  datasetId: 'CYBERJUDAH',
  sourceVersion: metadata.sourceCommit,
  textRevision: metadata.textSha256,
  textSha256: metadata.textSha256,
  sourceSha256: metadata.textSha256,
  verseCount: 0,
  verses: {},
}
const dbPath = join(output, 'bible-kjv-strong.sqlite')
await rm(dbPath, { force: true })
const db = new DatabaseSync(dbPath)
db.exec(`PRAGMA journal_mode=OFF; CREATE TABLE ResourceMetadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE Verses(id INTEGER PRIMARY KEY,bookOrder INTEGER,chapter INTEGER,verse INTEGER,UNIQUE(bookOrder,chapter,verse));
CREATE TABLE FrenchLexemes(id INTEGER PRIMARY KEY,lemma TEXT,partOfSpeech TEXT);
CREATE TABLE WordSpans(verseId INTEGER,ordinal INTEGER,startOffset INTEGER,length INTEGER,isAligned INTEGER,openOrder INTEGER,closeOrder INTEGER,lexemeId INTEGER,stepTokenId TEXT,PRIMARY KEY(verseId,ordinal));
CREATE TABLE StrongCodes(id INTEGER PRIMARY KEY,kind INTEGER,code TEXT,UNIQUE(kind,code));
CREATE TABLE WordStrongCodes(verseId INTEGER,ordinal INTEGER,identityOrder INTEGER,codeId INTEGER,PRIMARY KEY(verseId,ordinal,identityOrder));
CREATE INDEX idx_WordStrongCodes_lookup ON WordStrongCodes(codeId,verseId,ordinal,identityOrder);
CREATE TABLE WordStepTokenExtras(verseId INTEGER,targetOrdinal INTEGER,sourceOrder INTEGER,stepTokenId TEXT);
BEGIN;`)
const vInsert = db.prepare('INSERT INTO Verses VALUES(?,?,?,?)'),
  sInsert = db.prepare('INSERT INTO WordSpans VALUES(?,?,?,?,1,?,?,NULL,NULL)'),
  cInsert = db.prepare('INSERT OR IGNORE INTO StrongCodes VALUES(?,0,?)'),
  wInsert = db.prepare('INSERT INTO WordStrongCodes VALUES(?,?,?,?)')
let verseId = 0,
  spanCount = 0
for (const { book, chapter } of tasks) {
  const data = chapters.get(`${book.id}-${chapter}`)
  const verses = ((text.verses[book.id] ??= {})[chapter] = {})
  for (const v of data.verses) {
    text.verseCount++
    verses[v.verse] = { text: v.text, startTags: [], layout: [], notes: [], headings: [] }
    const id = ++verseId
    vInsert.run(id, book.id, chapter, v.verse)
    let offset = 0
    for (const [ordinal, [word, codes]] of (v.words ?? []).entries()) {
      const start = v.text.indexOf(word, offset)
      if (start < 0) throw new Error(`Invalid alignment: ${book.id}-${chapter}-${v.verse}`)
      offset = start + word.length
      if (!codes.length) continue
      sInsert.run(id, ordinal, start, word.length, ordinal * 2, ordinal * 2 + 1)
      spanCount++
      for (const [order, raw] of [...new Set(codes)].entries()) {
        const match = /^([HG])0*([1-9]\d*)$/.exec(raw)
        if (!match) throw new Error(`Invalid Strong identity ${raw}`)
        const n = Number(match[2]),
          code = `${match[1]}${n}`,
          codeId = n + (match[1] === 'G' ? 100000 : 0)
        cInsert.run(codeId, code)
        wInsert.run(id, ordinal, order, codeId)
      }
    }
  }
}
for (const [key, value] of Object.entries({
  applicationVersionId: 'KJV',
  datasetId: 'CYBERJUDAH',
  textRevision: metadata.textSha256,
  textSha256: metadata.textSha256,
  strongRevision: metadata.strongSha256,
  schemaVersion: 4,
}))
  db.prepare('INSERT INTO ResourceMetadata VALUES(?,?)').run(key, String(value))
db.exec('COMMIT; VACUUM;')
if (db.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok')
  throw new Error('Invalid SQLite archive')
db.close()
await writeFile(join(output, 'KJV.json'), JSON.stringify(text))
// Coverage carries verse counts only; record each chapter that does not begin at verse 1.
const firstVerseByBookChapter = {}
for (const [book, bookChapters] of Object.entries(text.verses))
  for (const [chapter, chapterVerses] of Object.entries(bookChapters)) {
    const first = Math.min(...Object.keys(chapterVerses).map(Number))
    if (first !== 1) firstVerseByBookChapter[`${book}-${chapter}`] = first
  }
await writeFile(
  join(app, 'src/assets/cyberjudah/verse-numbering.json'),
  JSON.stringify({ textSha256: metadata.textSha256, firstVerseByBookChapter }, null, 2) + '\n'
)
const existingCatalog = JSON.parse(
  await readFile(join(app, 'src/assets/cyberjudah/offline-catalog.json'), 'utf8')
)
const catalog = {
  format: 'bible-strong-mobile-resource-catalog',
  schemaVersion: 1,
  generatedAt: metadata.built,
  resourceCount: 2,
  resources: { ...existingCatalog.resources },
}
for (const [id, file, strategy] of [
  ['bible:KJV', 'KJV.json', 'sqlite-import'],
  ['bible-strong:KJV', 'bible-kjv-strong.sqlite', 'archive-extract'],
]) {
  execFileSync('python3', [
    '-c',
    `import zipfile,sys,pathlib\np=pathlib.Path(sys.argv[1])\nwith zipfile.ZipFile(str(p)+'.zip','w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:\n info=zipfile.ZipInfo(p.name,(2026,10,25,0,0,0)); info.compress_type=zipfile.ZIP_DEFLATED; z.writestr(info,p.read_bytes())`,
    join(output, file),
  ])
  const data = await readFile(join(output, file)),
    archive = await readFile(join(output, file + '.zip'))
  catalog.resources[id] = {
    id,
    url: `https://cyberjudah-telegram-staging.oisrae1.workers.dev/offline/${file}.zip?sha256=${hash(archive)}`,
    file: file + '.zip',
    entry: file,
    entries: { canonical: { entry: file, sha256: hash(data), bytes: data.length } },
    archiveSha256: hash(archive),
    archiveBytes: archive.length,
    contentSha256: hash(data),
    contentBytes: data.length,
    installedBytes: data.length * 2,
    peakInstallationBytes: data.length * 3 + archive.length,
    strategy,
    textRevision: metadata.textSha256,
    textSha256: metadata.textSha256,
  }
  await rm(join(output, file))
}
catalog.resourceCount = Object.keys(catalog.resources).length
await writeFile(
  join(app, 'src/assets/cyberjudah/offline-catalog.json'),
  JSON.stringify(catalog, null, 2) + '\n'
)
await writeFile(join(output, 'catalog.json'), JSON.stringify(catalog))
console.log(
  JSON.stringify({
    books: books.length,
    chapters: chapters.size,
    verses: text.verseCount,
    strongSpans: spanCount,
    archives: Object.values(catalog.resources).map(x => ({ id: x.id, bytes: x.archiveBytes })),
  })
)
