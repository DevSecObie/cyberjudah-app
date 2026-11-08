// Package committed study notes without changing their wording or link targets.
// Run from the repo: yarn workspace @bible-strong/expo exec tsx \
//   scripts/build-cyberjudah-commentary.mjs <cyberjudah-repo> [--ref <commit>]
// No network, source edits, app UI edits, upload or deployment is performed.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import { Marked } from 'marked'
import {
  buildNormalizedCommentaryReadingSections,
  createCommentaryReadingIndex,
} from '../../../packages/resource-domain/src/contracts/commentarySections.ts'

const app = resolve(import.meta.dirname, '..')
export const RESOURCE_ID = 'cyberjudah'
export const DOWNLOAD_ID = 'database:cyberjudah:en'
export const ENTRY = 'commentary-cyberjudah-en.sqlite'
const markdown = new Marked({ gfm: true, breaks: false })
const sha256 = value => createHash('sha256').update(value).digest('hex')
const git = (repo, args) =>
  execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const readCommitted = (repo, ref, path) => git(repo, ['show', `${ref}:${path}`])
const numericOrder = (left, right) => left.localeCompare(right, 'en', { numeric: true })

export function canonicalBookId(sourceId, mapping) {
  const id = sourceId <= 66 ? sourceId : Number(mapping.sourceToCanonical[String(sourceId)])
  if (!Number.isInteger(id) || id < 1 || !mapping.canonOrder.includes(id))
    throw new Error(`Missing/invalid shared canonical book mapping for source ID ${sourceId}`)
  return id
}

// This is the source repository's frontmatter boundary, not a content rewrite.
export function splitFrontmatter(raw) {
  const match = /^(?:\uFEFF)?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/u.exec(raw)
  return { body: raw.slice(match?.[0].length ?? 0), bodyOffset: match?.[0].length ?? 0 }
}

export function verseNumbers(spec, maxVerse) {
  const result = new Set()
  for (const part of spec.replace(/[–—]/gu, '-').split(',')) {
    const match = /^\s*(\d+)\s*(?:-\s*(\d+))?\s*$/u.exec(part)
    if (!match) throw new Error(`Invalid verse range: ${spec}`)
    const start = Number(match[1])
    const end = Number(match[2] ?? match[1])
    if (start < 1 || end < start || end > maxVerse)
      throw new Error(`Verse range outside source Bible: ${spec} (maximum ${maxVerse})`)
    for (let verse = start; verse <= end; verse++) result.add(verse)
  }
  return [...result].sort((a, b) => a - b)
}

// A precept can itself start with a bold link. Only headings for this study's
// own book/chapter(s) split its document; other scripture links stay in place.
export function splitStudyNote(raw, { file, book, bible, sourceFolder = book.slug, aliases = [] }) {
  const fileMatch = /^docs\/study\/([^/]+)\/(\d+)(?:-(\d+))?\.md$/u.exec(file)
  if (!fileMatch || fileMatch[1] !== sourceFolder) throw new Error(`Invalid study path: ${file}`)
  const firstChapter = Number(fileMatch[2])
  const lastChapter = Number(fileMatch[3] ?? fileMatch[2])
  if (lastChapter < firstChapter) throw new Error(`Invalid chapter range: ${file}`)
  const sources = new Map([{ book, bible }, ...aliases].map(source => [source.book.slug, source]))
  for (let chapter = firstChapter; chapter <= lastChapter; chapter++)
    if (
      ![...sources.values()].some(source => Array.isArray(source.bible.chapters[String(chapter)]))
    )
      throw new Error(`Missing source Bible chapter for ${file}: ${chapter}`)

  const { body, bodyOffset } = splitFrontmatter(raw)
  const boundaries = []
  const lines = /[^\n]*(?:\n|$)/gu
  for (const match of body.matchAll(lines)) {
    const line = match[0].replace(/\r?\n$/u, '')
    const linked = /^(?:\*\*|#{1,6}\s+)\[([^\]]+)\]\(([^)]+)\)/u.exec(line)
    if (!linked) continue
    const target = /^\/bible\/([a-z0-9-]+)\/(\d+)(?:#v(\d+))?$/u.exec(linked[2])
    if (!target || !sources.has(target[1])) continue
    const selected = sources.get(target[1])
    const chapter = Number(target[2])
    if (chapter < firstChapter || chapter > lastChapter) continue
    const labelRange = /:([\d\s,–—-]+)$/u.exec(linked[1].trim())
    const maxVerse = selected.bible.chapters[String(chapter)]?.length
    if (!maxVerse)
      throw new Error(`Missing explicitly linked Bible chapter: ${file}:${target[1]}/${chapter}`)
    const verses = labelRange
      ? verseNumbers(labelRange[1], maxVerse)
      : target[3]
        ? verseNumbers(target[3], maxVerse)
        : Array.from({ length: maxVerse }, (_, index) => index + 1)
    boundaries.push({ start: match.index, book: selected.book, chapter, verses })
  }

  const blocks = []
  const add = (start, end, targetBook, chapter, verses) => {
    if (start === end) return
    blocks.push({
      start: bodyOffset + start,
      end: bodyOffset + end,
      book: targetBook.id,
      chapter,
      verses,
      markdown: body.slice(start, end),
    })
  }
  if (!boundaries.length) {
    // An unpartitioned chapter study remains an introduction (verse 0), never
    // guessed onto individual verses by word overlap or newly authored text.
    add(0, body.length, book, firstChapter, [0])
  } else {
    add(0, boundaries[0].start, book, firstChapter, [0])
    boundaries.forEach((boundary, index) =>
      add(
        boundary.start,
        boundaries[index + 1]?.start ?? body.length,
        boundary.book,
        boundary.chapter,
        boundary.verses
      )
    )
  }
  if (blocks.map(block => block.markdown).join('') !== body)
    throw new Error(`Source body was not preserved: ${file}`)
  return { blocks, chapterOverviewOnly: !boundaries.length }
}

export const COMMENTARY_SCHEMA = `
  PRAGMA journal_mode = DELETE;
  PRAGMA synchronous = FULL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE RESOURCE_METADATA (
    resource_id TEXT NOT NULL, language TEXT NOT NULL, revision TEXT NOT NULL,
    source_version TEXT NOT NULL, source_sha256 TEXT NOT NULL
  );
  CREATE TABLE COMMENTARY_DOCUMENTS (id TEXT PRIMARY KEY NOT NULL, content TEXT NOT NULL);
  CREATE TABLE COMMENTARY_VERSE_DOCUMENTS (
    verse_key TEXT NOT NULL, ordinal INTEGER NOT NULL,
    document_id TEXT NOT NULL REFERENCES COMMENTARY_DOCUMENTS(id),
    PRIMARY KEY (verse_key, ordinal)
  );
  CREATE INDEX COMMENTARY_VERSE_DOCUMENTS_LOOKUP ON COMMENTARY_VERSE_DOCUMENTS (verse_key);
  CREATE TABLE COMMENTARY_READING_SECTIONS (
    id TEXT PRIMARY KEY NOT NULL, book INTEGER NOT NULL, chapter INTEGER NOT NULL,
    range_start_verse INTEGER NOT NULL, range_end_verse INTEGER NOT NULL, excerpt TEXT NOT NULL
  );
  CREATE INDEX COMMENTARY_READING_CHAPTER ON COMMENTARY_READING_SECTIONS
    (book, chapter, range_start_verse, range_end_verse, id);
  -- Provenance tables are ignored by upstream readers. They retain the exact
  -- committed source, including frontmatter, instead of silently discarding it.
  CREATE TABLE CYBERJUDAH_SOURCE_NOTES (
    file TEXT PRIMARY KEY NOT NULL, sha256 TEXT NOT NULL, markdown TEXT NOT NULL
  );
  CREATE TABLE CYBERJUDAH_SOURCE_BLOCKS (
    document_id TEXT PRIMARY KEY NOT NULL REFERENCES COMMENTARY_DOCUMENTS(id),
    file TEXT NOT NULL REFERENCES CYBERJUDAH_SOURCE_NOTES(file),
    start_offset INTEGER NOT NULL, end_offset INTEGER NOT NULL
  );
  CREATE TABLE CYBERJUDAH_BUILD_METADATA (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
`

export async function buildCommentary({
  source,
  ref = 'HEAD',
  output,
  metadataOutput,
  databaseDir,
}) {
  source = resolve(source)
  const sourceCommit = git(source, ['rev-parse', '--verify', `${ref}^{commit}`]).trim()
  const files = git(source, ['ls-tree', '-r', '--name-only', sourceCommit, '--', 'docs/study'])
    .trim()
    .split('\n')
    .filter(path => /^docs\/study\/[^/]+\/\d+(?:-\d+)?\.md$/u.test(path))
    .sort(numericOrder)
  if (!files.length) throw new Error('No committed chapter study notes were found')
  const books = JSON.parse(
    await readFile(join(app, 'scripts/data/cyberjudah-commentary-books.json'), 'utf8')
  )
  const bySlug = new Map(books.map(book => [book.slug, book]))
  if (books.length !== 81 || books.find(book => book.id === 66)?.code !== 'Rev')
    throw new Error('Invalid standard/Apocrypha book-code mapping')
  // This shared packaging adapter is owned by the clean-build implementer.
  // Source IDs and canonical IDs differ for the Apocrypha; never invent a second map.
  const canonicalBookMap = JSON.parse(
    await readFile(join(app, 'src/assets/cyberjudah/canonical-book-map.json'), 'utf8')
  )
  for (const book of books) {
    const canonicalId = canonicalBookId(book.id, canonicalBookMap)
    bySlug.set(book.slug, { ...book, sourceId: book.id, id: canonicalId })
  }
  if (new Set([...bySlug.values()].map(book => book.id)).size !== books.length)
    throw new Error('Shared canonical book mapping contains colliding identities')
  const bibleCache = new Map()
  const documents = []
  const sourceNotes = []
  const sourceBlocks = []
  const chapters = new Map()
  const overviewOnly = []
  const corpusHash = createHash('sha256')
  let verseAssociations = 0

  for (const file of files) {
    const slug = file.split('/')[2]
    let book = bySlug.get(slug)
    if (!book) throw new Error(`Unmapped source book: ${slug}`)
    const raw = readCommitted(source, sourceCommit, file)
    const sourceHash = sha256(raw)
    corpusHash.update(file).update('\0').update(sourceHash).update('\n')
    sourceNotes.push({ file, sha256: sourceHash, markdown: raw })
    if (!bibleCache.has(slug))
      bibleCache.set(
        slug,
        JSON.parse(readCommitted(source, sourceCommit, `data/bible/${slug}.json`))
      )
    let bible = bibleCache.get(slug)
    const aliases = []
    // The committed Esther study folder also contains the Greek additions;
    // its headings explicitly link /bible/esther-greek, including chapter 10.
    if (slug === 'esther') {
      const greekBook = bySlug.get('esther-greek')
      if (!bibleCache.has('esther-greek'))
        bibleCache.set(
          'esther-greek',
          JSON.parse(readCommitted(source, sourceCommit, 'data/bible/esther-greek.json'))
        )
      const greek = { book: greekBook, bible: bibleCache.get('esther-greek') }
      const firstChapter = Number(/\/(\d+)(?:-\d+)?\.md$/u.exec(file)[1])
      if (!bible.chapters[String(firstChapter)]) {
        aliases.push({ book, bible })
        book = greek.book
        bible = greek.bible
      } else aliases.push(greek)
    }
    const parsed = splitStudyNote(raw, { file, book, bible, sourceFolder: slug, aliases })
    if (parsed.chapterOverviewOnly) overviewOnly.push(file)
    for (const block of parsed.blocks) {
      if (!block.markdown.trim()) continue
      const id = `${file}:${block.start}:${block.end}`
      const content = markdown.parse(block.markdown)
      documents.push({ id, content })
      sourceBlocks.push({ documentId: id, file, start: block.start, end: block.end })
      const chapterKey = `${block.book}-${block.chapter}`
      const chapter = chapters.get(chapterKey) ?? {
        book: block.book,
        chapter: block.chapter,
        documents: [],
        associations: [],
        ordinals: new Map(),
      }
      chapter.documents.push({ id, content })
      for (const verse of block.verses) {
        const ordinal = chapter.ordinals.get(verse) ?? 0
        chapter.associations.push({ verse, documentId: id, ordinal })
        chapter.ordinals.set(verse, ordinal + 1)
        verseAssociations++
      }
      chapters.set(chapterKey, chapter)
    }
  }

  const sourceSha256 = corpusHash.digest('hex')
  const revisionHash = sha256(
    JSON.stringify({
      sourceCommit,
      sourceSha256,
      schema: COMMENTARY_SCHEMA,
      documents,
      associations: [...chapters].map(([key, chapter]) => [key, chapter.associations]),
      readingImplementation: sha256(
        await readFile(
          new URL(
            '../../../packages/resource-domain/src/contracts/commentarySections.ts',
            import.meta.url
          )
        )
      ),
    })
  )
  const revision = `cyberjudah-en-${revisionHash.slice(0, 20)}`
  await mkdir(output, { recursive: true })
  await mkdir(metadataOutput, { recursive: true })
  await mkdir(databaseDir, { recursive: true })
  await writeFile(join(databaseDir, '.gitignore'), '*\n!.gitignore\n')
  const databasePath = join(databaseDir, ENTRY)
  const database = new DatabaseSync(databasePath)
  let readingSections = 0
  try {
    // Refuse accidental overwrites. A rebuild uses a fresh output directory.
    if (database.prepare("SELECT name FROM sqlite_master WHERE type='table'").get())
      throw new Error(`Output database already exists: ${databasePath}`)
    database.exec(COMMENTARY_SCHEMA)
    database.exec('BEGIN IMMEDIATE')
    const insertSource = database.prepare('INSERT INTO CYBERJUDAH_SOURCE_NOTES VALUES (?,?,?)')
    const insertDocument = database.prepare('INSERT INTO COMMENTARY_DOCUMENTS VALUES (?,?)')
    const insertBlock = database.prepare('INSERT INTO CYBERJUDAH_SOURCE_BLOCKS VALUES (?,?,?,?)')
    const insertAssociation = database.prepare(
      'INSERT INTO COMMENTARY_VERSE_DOCUMENTS VALUES (?,?,?)'
    )
    const insertIndex = database.prepare(
      'INSERT INTO COMMENTARY_READING_SECTIONS VALUES (?,?,?,?,?,?)'
    )
    for (const note of sourceNotes) insertSource.run(note.file, note.sha256, note.markdown)
    for (const document of documents) insertDocument.run(document.id, document.content)
    for (const block of sourceBlocks)
      insertBlock.run(block.documentId, block.file, block.start, block.end)
    for (const [key, chapter] of [...chapters.entries()].sort(([a], [b]) => numericOrder(a, b))) {
      for (const association of chapter.associations)
        insertAssociation.run(
          `${key}-${association.verse}`,
          association.ordinal,
          association.documentId
        )
      // Use the very same section/index functions as the unmodified reader.
      const sections = buildNormalizedCommentaryReadingSections({
        entry: { id: RESOURCE_ID, publicationId: RESOURCE_ID },
        language: 'en',
        ...chapter,
      })
      for (const section of createCommentaryReadingIndex(sections)) {
        insertIndex.run(
          section.id,
          chapter.book,
          chapter.chapter,
          section.rangeStartVerse,
          section.rangeEndVerse,
          section.excerpt
        )
        readingSections++
      }
    }
    database
      .prepare('INSERT INTO RESOURCE_METADATA VALUES (?,?,?,?,?)')
      .run(RESOURCE_ID, 'en', revision, sourceCommit, sourceSha256)
    const insertBuildMeta = database.prepare('INSERT INTO CYBERJUDAH_BUILD_METADATA VALUES (?,?)')
    insertBuildMeta.run('canonical_book_map_sha256', sha256(JSON.stringify(canonicalBookMap)))
    insertBuildMeta.run('canonical_book_map_version', String(canonicalBookMap.version))
    insertBuildMeta.run('source_repository', 'https://github.com/DevSecObie/cyberjudah')
    database.exec('COMMIT; VACUUM;')
    if (database.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok')
      throw new Error('SQLite integrity check failed')
    if (database.prepare('PRAGMA foreign_key_check').get())
      throw new Error('SQLite foreign-key check failed')
    if (
      database.prepare('SELECT COUNT(*) AS n FROM CYBERJUDAH_SOURCE_NOTES').get().n !== files.length
    )
      throw new Error('Source-note preservation count mismatch')
  } finally {
    database.close()
  }
  const archivePath = join(output, `${ENTRY}.zip`)
  execFileSync('python3', [
    '-c',
    [
      'import pathlib,sys,zipfile',
      'source,target,entry=map(str,sys.argv[1:])',
      'info=zipfile.ZipInfo(entry,date_time=(1980,1,1,0,0,0))',
      'info.compress_type=zipfile.ZIP_DEFLATED',
      'info.external_attr=0o100644<<16',
      'with zipfile.ZipFile(target,"w",compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:',
      ' z.writestr(info,pathlib.Path(source).read_bytes(),compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)',
    ].join('\n'),
    databasePath,
    archivePath,
    ENTRY,
  ])
  const content = await readFile(databasePath)
  const archive = await readFile(archivePath)
  if (archive.length > 25 * 1024 * 1024)
    throw new Error('Archive exceeds the static-asset 25 MiB limit')
  const contentSha256 = sha256(content)
  const archiveSha256 = sha256(archive)
  const download = {
    id: DOWNLOAD_ID,
    url: `https://api.cyberjudah.io/v1/offline-artifacts/commentaries/${ENTRY}.zip?sha256=${archiveSha256}`,
    file: `commentaries/${ENTRY}.zip`,
    entry: ENTRY,
    entries: { canonical: { entry: ENTRY, sha256: contentSha256, bytes: content.length } },
    archiveSha256,
    archiveBytes: archive.length,
    contentSha256,
    contentBytes: content.length,
    resourceRevision: revision,
    installedBytes: content.length,
    peakInstallationBytes: Math.ceil((content.length + archive.length) * 1.15),
    strategy: 'archive-extract',
  }
  const catalog = {
    id: RESOURCE_ID,
    publicationId: RESOURCE_ID,
    shortName: 'CyberJudah',
    title: 'CyberJudah Study Notes',
    description: { en: 'CyberJudah study notes.' },
    author: 'CyberJudah',
    languages: ['en'],
    tradition: '',
    tags: [],
    rights: 'CyberJudah study notes · source attribution and links preserved',
  }
  await writeFile(
    join(metadataOutput, 'cyberjudah-commentary-download.json'),
    `${JSON.stringify(download, null, 2)}\n`
  )
  await writeFile(
    join(metadataOutput, 'cyberjudah-commentary-catalog.json'),
    `${JSON.stringify(catalog, null, 2)}\n`
  )
  return {
    sourceCommit,
    sourceSha256,
    revision,
    sourceNotes: files.length,
    documents: documents.length,
    chapters: chapters.size,
    verseAssociations,
    distinctVerses: [...chapters.values()].reduce(
      (n, chapter) => n + [...chapter.ordinals.keys()].filter(v => v > 0).length,
      0
    ),
    overviewOnly,
    readingSections,
    archivePath,
    databasePath,
    download,
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [source, ...options] = process.argv.slice(2)
  if (!source) throw new Error('Pass a local DevSecObie/cyberjudah repository path')
  const value = (flag, fallback) => {
    const index = options.indexOf(flag)
    return index < 0 ? fallback : options[index + 1]
  }
  const result = await buildCommentary({
    source,
    ref: value('--ref', 'HEAD'),
    output: resolve(value('--output', join(app, 'public/offline-artifacts/commentaries'))),
    metadataOutput: resolve(value('--metadata-output', join(app, 'scripts/data'))),
    databaseDir: resolve(value('--database-dir', join(app, '.artifacts/cyberjudah-commentary'))),
  })
  console.log(JSON.stringify(result, null, 2))
}
