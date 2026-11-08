// Rebuild the kept dictionaries from public-domain or freely licensed sources, in Bible Strong's
// own format, with Bible Strong's own acquisition and normalization scripts
// (apps/resource-studio/workflows/dictionaries/scripts). Writes the archives under public/offline
// (served at /v1/offline-artifacts/<file>, the URL in each catalog entry):
//   public/offline/dictionaries/dictionary-<work>-<language>.sqlite.zip   (entry dictionnaire.sqlite)
//   public/offline/dictionaries/dictionary-directory.sqlite.zip           (entry dictionary-directory.sqlite)
// and the catalog entries to scripts/data/free-dictionary-catalog-entries.json (t56 merges them).
// It follows apps/resource-studio/src/packageDictionaryResourcePublications.ts: normalize the
// library, build the directory (it keeps the verse-name and verse-phrase anchors), then drop those
// anchors from each dictionary, write RESOURCE_METADATA and zip it.
// The directory also lists the dictionaries in free-dictionaries.json "directoryOnly": our own
// dictionaries. A copy of each goes through normalization with the others so that it joins the
// correspondence groups (and the free dictionaries' cross-entry links), but the directory is then
// rebuilt from the published file itself: its entries and passage anchors are the published ones
// (checked). Normalizing that copy also shapes the free dictionaries' generated cross-entry links,
// as upstream's whole-library normalization does. Its published archive is never changed.
//
// Usage: node scripts/build-free-dictionaries.mjs --sources <dir> [--acquire --mod2imp <path>]
//   --sources  folder holding each acquisition output (sqlitePath in free-dictionaries.json is
//              relative to it); with --acquire the acquisition scripts write there first.
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rename, rm } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const app = resolve(import.meta.dirname, '..')
const workflow = resolve(app, '../resource-studio/workflows/dictionaries/scripts')
const output = join(app, 'public/offline')
const MAX_ARCHIVE = 25 * 1024 * 1024 // Workers static assets serve files up to 25 MiB.

const args = process.argv.slice(2)
const option = name => {
  const index = args.indexOf(name)
  if (index < 0) return undefined
  const value = args[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`${name} needs a value`)
  return value
}
const sourcesOption = option('--sources')
if (!sourcesOption) throw new Error('Usage: build-free-dictionaries.mjs --sources <dir> [--acquire --mod2imp <path>]')
const sources = resolve(sourcesOption)
const mod2imp = option('--mod2imp')

const hash = data => createHash('sha256').update(data).digest('hex')
const config = JSON.parse(await readFile(join(app, 'scripts/data/free-dictionaries.json'), 'utf8'))
const publications = config.publications
const directoryOnly = config.directoryOnly ?? []
for (const p of [...publications, ...directoryOnly])
  if (!/^[a-z0-9-]+$/.test(p.work) || !/^[A-Z0-9_]+$/.test(p.resourceId) || !['en', 'fr'].includes(p.language))
    throw new Error(`Bad publication identity: ${p.work}`)

// The catalog URL origin is the one the app's catalog already uses (read only).
const appCatalog = JSON.parse(await readFile(join(app, 'src/assets/cyberjudah/offline-catalog.json'), 'utf8'))
const origin = new URL(appCatalog.resources['bible:KJV'].url).origin

if (args.includes('--acquire')) {
  for (const p of publications) {
    const run = [join(workflow, p.acquire.script), '--output-dir', join(sources, p.acquire.outputDir)]
    if (p.acquire.mod2imp) {
      if (!mod2imp) throw new Error(`${p.work} needs --mod2imp`)
      run.push('--mod2imp', resolve(mod2imp))
    }
    execFileSync(process.execPath, run, { stdio: 'inherit' })
  }
}

// Zip one file as a single regular-file entry; the app rejects other entry types (zipArchiveValidation).
const zip = (source, entry, target) =>
  execFileSync('python3', [
    '-I',
    '-c',
    `import zipfile,sys
data=open(sys.argv[1],'rb').read()
with zipfile.ZipFile(sys.argv[3],'w') as z:
 info=zipfile.ZipInfo(sys.argv[2],(2026,10,25,0,0,0)); info.compress_type=zipfile.ZIP_DEFLATED; info.create_system=3; info.external_attr=0o100644<<16
 z.writestr(info,data,compresslevel=9)`,
    source,
    entry,
    target,
  ])

// Upstream's deriveDictionaryRevision over upstream's readDictionarySqlite view of the file.
const isNonEmptyString = value => typeof value === 'string' && value.trim().length > 0
const normalizeDictionaryWord = word => word.trim().toLocaleLowerCase()
const isDictionaryVerseKey = value =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 128 &&
  value === value.trim() &&
  value.split('-').length === 3 &&
  value.split('-').every(segment => segment.length > 0) &&
  !Array.from(value).some(character => character === '\\' || character === '/' || character.charCodeAt(0) <= 0x1f)
// Upstream's readDictionarySqlite checks, before the revision is derived.
const validateDictionary = (db, work) => {
  const fail = reason => {
    throw new Error(`${work}: ${reason}`)
  }
  const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name))
  for (const table of ['dictionnaire', 'dictionary_correspondences', 'dictionary_passage_anchors', 'verses'])
    if (!tables.has(table)) fail(`table ${table} missing`)
  const ids = new Set()
  const rows = db.prepare('SELECT id, sanitized_word, word, definition FROM dictionnaire').all()
  if (rows.length === 0) fail('no entries')
  for (const row of rows) {
    if (!Number.isSafeInteger(row.id) || row.id <= 0 || ids.has(row.id)) fail(`bad entry id ${row.id}`)
    if (!isNonEmptyString(row.sanitized_word) || !isNonEmptyString(row.word) || typeof row.definition !== 'string')
      fail(`bad entry ${row.id}`)
    if (!normalizeDictionaryWord(row.sanitized_word)) fail(`empty normalized word ${row.id}`)
    ids.add(row.id)
  }
  // Upstream reads entries LEFT JOINed to their correspondence: one correspondence per entry.
  if (db.prepare('SELECT entry_id FROM dictionary_correspondences GROUP BY entry_id HAVING count(*) > 1 LIMIT 1').get())
    fail('entry with several correspondences')
  const verseKeys = new Set()
  for (const row of db.prepare('SELECT id, ref FROM verses').all()) {
    if (verseKeys.has(row.id)) fail(`duplicate verse key ${row.id}`)
    verseKeys.add(row.id)
    if (!isDictionaryVerseKey(row.id)) fail(`bad verse key ${row.id}`)
    let refs
    try {
      refs = JSON.parse(row.ref)
    } catch {
      fail(`bad verse references ${row.id}`)
    }
    if (!Array.isArray(refs) || refs.some(ref => typeof ref !== 'string' || !ref.trim() || !normalizeDictionaryWord(ref)))
      fail(`bad verse references ${row.id}`)
  }
  const anchors = new Set()
  for (const row of db.prepare('SELECT verse_key, entry_id, evidence_kind, ordinal FROM dictionary_passage_anchors').all()) {
    const identity = `${row.verse_key}:${row.entry_id}:${row.evidence_kind}`
    if (
      !isDictionaryVerseKey(row.verse_key) ||
      !ids.has(row.entry_id) ||
      !['source-citation', 'verse-name', 'verse-phrase'].includes(row.evidence_kind) ||
      !Number.isSafeInteger(row.ordinal) ||
      row.ordinal < 0 ||
      anchors.has(identity)
    )
      fail(`bad passage anchor ${identity}`)
    anchors.add(identity)
  }
}
const deriveRevision = (db, work, language) => {
  const entries = db
    .prepare(
      `SELECT entry.id, entry.sanitized_word, entry.word, entry.definition, correspondence.correspondence_id
       FROM dictionnaire entry
       LEFT JOIN dictionary_correspondences correspondence ON correspondence.entry_id = entry.id
       ORDER BY entry.id`,
    )
    .all()
    .map(row => ({
      id: row.id,
      word: row.word,
      normalizedWord: normalizeDictionaryWord(row.sanitized_word),
      definition: row.definition,
      ...(isNonEmptyString(row.correspondence_id) ? { correspondenceId: row.correspondence_id } : {}),
    }))
  const verseAnchors = db
    .prepare('SELECT id, ref FROM verses ORDER BY id')
    .all()
    .map(row => ({ verseKey: row.id, words: [...new Set(JSON.parse(row.ref).map(normalizeDictionaryWord))] }))
  const byVerse = new Map()
  for (const row of db
    .prepare('SELECT verse_key, entry_id, evidence_kind FROM dictionary_passage_anchors ORDER BY verse_key, ordinal, entry_id')
    .all()) {
    const list = byVerse.get(row.verse_key) ?? []
    list.push({ entryId: row.entry_id, evidenceKind: row.evidence_kind })
    byVerse.set(row.verse_key, list)
  }
  const passageAnchors = [...byVerse].map(([verseKey, list]) => ({ verseKey, entries: list }))
  const semantic = hash(Buffer.from(JSON.stringify({ work, language, entries, verseAnchors, passageAnchors }), 'utf8'))
  return `dictionary-${work}-${language}-${semantic.slice(0, 20)}`
}

const integrity = db => {
  const result = db.prepare('PRAGMA integrity_check').get().integrity_check
  if (result !== 'ok') throw new Error(`Integrity check failed: ${result}`)
}

const work = await mkdtemp(join(tmpdir(), 'free-dictionaries-'))
try {
  // The verse-presence step matches dictionary headwords in a French and an English reference Bible.
  // Upstream uses LSG and the 66-book KJV; we use our FMAR and our KJVA limited to books 1-66.
  const unzipJson = (file, entry) =>
    JSON.parse(execFileSync('unzip', ['-p', join(output, file), entry], { maxBuffer: 64 * 1024 * 1024 }))
  const kjva = unzipJson('bibles/bible-kjva.json.zip', 'bible-kjva.json')
  const kjv = join(work, 'kjv.json')
  await writeFile(
    kjv,
    JSON.stringify({ verses: Object.fromEntries(Object.entries(kjva.verses).filter(([book]) => Number(book) <= 66)) }),
  )
  const fr = join(work, 'fr.json')
  await writeFile(fr, JSON.stringify(unzipJson('bibles/bible-fmar.json.zip', 'bible-fmar.json')))

  // Our own dictionaries are normalized with the others (a copy), as upstream normalizes its whole
  // library together, so they join the correspondence groups.
  const ownCopies = join(work, 'own')
  await mkdir(ownCopies)
  for (const p of directoryOnly) {
    const copy = join(ownCopies, `${p.work}.sqlite`)
    await writeFile(copy, execFileSync('unzip', ['-p', join(output, p.file), 'dictionnaire.sqlite'], { maxBuffer: 512 * 1024 * 1024 }))
    // The checks the directory relies on: a sound file with valid entries and passage anchors.
    const db = new DatabaseSync(copy, { readOnly: true })
    integrity(db)
    const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name))
    if (!tables.has('dictionnaire') || !tables.has('dictionary_passage_anchors')) throw new Error(`${p.work}: tables missing`)
    const bad = db
      .prepare(
        `SELECT id FROM dictionnaire WHERE typeof(id) != 'integer' OR id <= 0 OR trim(coalesce(word, '')) = ''
         OR trim(coalesce(sanitized_word, '')) = '' OR typeof(definition) != 'text' LIMIT 1`,
      )
      .get()
    if (bad) throw new Error(`${p.work}: bad entry ${bad.id}`)
    for (const row of db.prepare('SELECT verse_key, entry_id, evidence_kind, ordinal FROM dictionary_passage_anchors').all())
      if (
        !isDictionaryVerseKey(row.verse_key) ||
        !['source-citation', 'verse-name', 'verse-phrase'].includes(row.evidence_kind) ||
        !Number.isSafeInteger(row.ordinal) ||
        row.ordinal < 0
      )
        throw new Error(`${p.work}: bad passage anchor ${row.verse_key}`)
    db.close()
  }
  const configPath = join(work, 'dictionary.json')
  const normalizationPublications = [
    ...publications.map(({ file, acquire, ...p }) => ({
      ...p,
      sqlitePath: join(sources, p.sqlitePath),
      ...(p.correspondenceSeedsPath ? { correspondenceSeedsPath: join(sources, p.correspondenceSeedsPath) } : {}),
    })),
    ...directoryOnly.map(({ file, ...p }) => ({ ...p, sqlitePath: join(ownCopies, `${p.work}.sqlite`) })),
  ]
  await writeFile(configPath, JSON.stringify({ publications: normalizationPublications }, null, 2))
  const normalized = join(work, 'normalized')
  execFileSync(
    process.execPath,
    [join(workflow, 'normalize-library.mjs'), '--config', configPath, '--output-root', normalized, '--lsg-bible', fr, '--kjv-bible', kjv],
    { stdio: 'inherit' },
  )
  // Put our own dictionaries back exactly as published, then build the directory from them and
  // the normalized free dictionaries, with the correspondence groups computed above.
  for (const p of directoryOnly) await copyFile(join(ownCopies, `${p.work}.sqlite`), join(normalized, `${p.work}.sqlite`))
  const directoryPath = join(work, 'dictionary-directory.sqlite')
  execFileSync(process.execPath, [
    join(workflow, 'build-directory.mjs'),
    '--config', configPath,
    '--normalized-root', normalized,
    '--correspondences', join(normalized, 'correspondences.json'),
    '--output', directoryPath,
  ])

  // The directory must list our own dictionaries exactly as they are published: entries with
  // their normalized words, and every passage anchor.
  const listed = new DatabaseSync(directoryPath, { readOnly: true })
  for (const p of directoryOnly) {
    const published = new DatabaseSync(join(ownCopies, `${p.work}.sqlite`), { readOnly: true })
    const same = (a, b, what) => {
      if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${p.work}: the directory's ${what} differ from the published file`)
    }
    const workKey = '(SELECT work_key FROM dictionary_works WHERE work = ?)'
    same(
      published.prepare('SELECT id, word, sanitized_word FROM dictionnaire ORDER BY id').all(),
      listed.prepare(`SELECT entry_id AS id, word, normalized_word AS sanitized_word FROM dictionary_entries WHERE work_key = ${workKey} ORDER BY entry_id`).all(p.work),
      'entries',
    )
    same(
      published.prepare('SELECT verse_key, entry_id, evidence_kind, ordinal FROM dictionary_passage_anchors ORDER BY verse_key, entry_id, evidence_kind').all(),
      listed
        .prepare(
          `SELECT anchor.verse_key, anchor.entry_id, evidence.evidence_kind, anchor.ordinal FROM dictionary_passage_anchors anchor
           JOIN dictionary_anchor_evidence evidence USING (evidence_key) WHERE anchor.work_key = ${workKey}
           ORDER BY anchor.verse_key, anchor.entry_id, evidence.evidence_kind`,
        )
        .all(p.work),
      'passage anchors',
    )
    published.close()
  }
  listed.close()

  // Build every archive in the work folder; publish only once all of them pass.
  const staged = join(work, 'staged')
  await mkdir(join(staged, 'dictionaries'), { recursive: true })
  const entries = {}
  const record = async (id, file, entry, contentPath, revision, extra = {}) => {
    const data = await readFile(contentPath)
    const archive = await readFile(join(staged, file))
    if (archive.length > MAX_ARCHIVE) throw new Error(`${file} is over 25 MiB (${archive.length} bytes)`)
    const contentSha256 = hash(data)
    const archiveSha256 = hash(archive)
    entries[id] = {
      id,
      url: `${origin}/v1/offline-artifacts/${file}?sha256=${archiveSha256}`,
      file,
      entry,
      entries: { canonical: { entry, sha256: contentSha256, bytes: data.length } },
      archiveSha256,
      archiveBytes: archive.length,
      contentSha256,
      contentBytes: data.length,
      resourceRevision: revision,
      installedBytes: data.length,
      peakInstallationBytes: Math.ceil((archive.length + data.length) * 1.15),
      strategy: 'archive-extract',
      ...extra,
    }
  }

  const directory = new DatabaseSync(directoryPath, { readOnly: true })
  integrity(directory)
  const directoryMeta = directory.prepare('SELECT * FROM RESOURCE_METADATA').get()
  const works = directory.prepare('SELECT resource_id FROM dictionary_works ORDER BY work_key').all()
  // Upstream's directory publication checks: metadata present and matching the tables.
  const counts = directory
    .prepare(
      `SELECT (SELECT COUNT(*) FROM dictionary_works) AS works, (SELECT COUNT(*) FROM dictionary_entries) AS entries,
              (SELECT COUNT(*) FROM dictionary_correspondences) AS correspondences,
              (SELECT COUNT(*) FROM dictionary_passage_anchors) AS passageAnchors`,
    )
    .get()
  directory.close()
  if (
    directoryMeta?.resource_id !== 'dictionary-directory' ||
    directoryMeta.schema_version !== 1 ||
    !/^dictionary-directory-[0-9a-f]{20}$/.test(directoryMeta.revision) ||
    directoryMeta.works_count !== counts.works ||
    directoryMeta.entries_count !== counts.entries ||
    directoryMeta.correspondences_count !== counts.correspondences ||
    directoryMeta.passage_anchors_count !== counts.passageAnchors ||
    counts.entries === 0
  )
    throw new Error('The directory metadata does not match its tables')
  const expected = [...publications, ...directoryOnly].map(p => p.resourceId)
  if (works.map(w => w.resource_id).join() !== expected.join())
    throw new Error('The directory lists other dictionaries than the kept ones')
  const directoryFile = 'dictionaries/dictionary-directory.sqlite.zip'
  zip(directoryPath, 'dictionary-directory.sqlite', join(staged, directoryFile))
  await record('dictionary-directory', directoryFile, 'dictionary-directory.sqlite', directoryPath, directoryMeta.revision, {
    works: expected,
    entryCount: directoryMeta.entries_count,
  })

  for (const p of publications) {
    const sqlitePath = join(normalized, `${p.work}.sqlite`)
    const db = new DatabaseSync(sqlitePath)
    db.exec(
      "DELETE FROM dictionary_passage_anchors WHERE evidence_kind IN ('verse-name', 'verse-phrase'); PRAGMA optimize; VACUUM;",
    )
    db.close()
    // Upstream's source_sha256 is the hash of the prepared file it packages.
    const sourceSha256 = hash(await readFile(sqlitePath))
    const writer = new DatabaseSync(sqlitePath)
    validateDictionary(writer, p.work)
    const revision = deriveRevision(writer, p.work, p.language)
    writer.exec(`BEGIN IMMEDIATE;
      DROP TABLE IF EXISTS RESOURCE_METADATA;
      CREATE TABLE RESOURCE_METADATA (resource_id TEXT NOT NULL, work TEXT NOT NULL, language TEXT NOT NULL, revision TEXT NOT NULL, source_version TEXT NOT NULL, source_sha256 TEXT NOT NULL);`)
    try {
      writer
        .prepare('INSERT INTO RESOURCE_METADATA VALUES (?, ?, ?, ?, ?, ?)')
        .run(`dictionary:${p.work}:${p.language}`, p.work, p.language, revision, p.sourceVersion, sourceSha256)
      writer.exec('COMMIT;')
    } catch (error) {
      writer.exec('ROLLBACK;')
      throw error
    }
    integrity(writer)
    const { count } = writer.prepare('SELECT count(*) AS count FROM dictionnaire').get()
    writer.close()
    zip(sqlitePath, 'dictionnaire.sqlite', join(staged, p.file))
    await record(`database:${p.resourceId}:${p.language}`, p.file, 'dictionnaire.sqlite', sqlitePath, revision, { entryCount: count })
  }

  await mkdir(join(output, 'dictionaries'), { recursive: true })
  // Copy everything next to its target first, then rename each into place, then write the catalog.
  // On any failure, no .partial file is left behind; rerun the script to put archives and catalog
  // back in step.
  const catalogPath = join(app, 'scripts/data/free-dictionary-catalog-entries.json')
  const partials = Object.values(entries).map(e => join(output, `${e.file}.partial`))
  try {
    for (const e of Object.values(entries)) await copyFile(join(staged, e.file), join(output, `${e.file}.partial`))
    await writeFile(`${catalogPath}.partial`, JSON.stringify({ resources: entries }, null, 2) + '\n')
    for (const e of Object.values(entries)) await rename(join(output, `${e.file}.partial`), join(output, e.file))
    await rename(`${catalogPath}.partial`, catalogPath)
  } finally {
    for (const partial of [...partials, `${catalogPath}.partial`]) await rm(partial, { force: true })
  }
  for (const e of Object.values(entries))
    console.log(`${e.id} ${e.file} ${e.archiveBytes} bytes sha256 ${e.archiveSha256} ${e.resourceRevision}`)
} finally {
  await rm(work, { recursive: true, force: true })
}
