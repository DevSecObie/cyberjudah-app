// Build Bible Strong's People module (strong-lexicon:entities) from CyberJudah's KJV people,
// places and other names. Nothing comes from STEPBible or TIPNR: every record, verse and family
// link is the published CyberJudah catalog, and a place has coordinates only where it has a pin.
// Usage: node scripts/build-cyberjudah-entities.mjs <path to a DevSecObie/cyberjudah checkout>
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
const app = resolve(import.meta.dirname, '..')
const source = resolve(process.argv[2] ?? '')
const sourceCommit = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], {
  encoding: 'utf8',
}).trim()
const read = async path => JSON.parse(await readFile(join(source, path), 'utf8'))
const { people } = await read('data/people-kjv/people.json')
const { places } = await read('data/places-kjv/places.json')
const { other } = await read('data/other-kjv/other.json')
const books = JSON.parse(await readFile(join(app, 'src/assets/cyberjudah/books.json'), 'utf8'))
const bookCodes = JSON.parse(
  await readFile(join(app, 'src/assets/cyberjudah/entity-book-codes.json'), 'utf8')
)
const output = join(app, 'public/offline')
const file = 'bible_entities.cyberjudah.sqlite'
const hash = data => createHash('sha256').update(data).digest('hex')
const html = s =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const bySlug = new Map(books.map(book => [book.slug, book]))
const reference = ref => {
  const [slug, chapter, verse] = ref.split('/')
  const book = bySlug.get(slug)
  if (!book || !/^[1-9]\d*$/.test(chapter) || !/^[1-9]\d*$/.test(verse))
    throw new Error(`Unknown verse reference: ${ref}`)
  return { book, chapter: Number(chapter), verse: Number(verse) }
}
// The labels the catalog itself defines for each link's evidence.
const EVIDENCE = {
  scripture: 'Scripturally confirmed',
  parallel: 'Parallel identification',
  history: 'Historically identified',
  variant: 'Textual variant',
}
const RELATIONS = [
  ['father', 'father'],
  ['mother', 'mother'],
  ['partners', 'partner'],
  ['siblings', 'sibling'],
  ['children', 'offspring'],
]
const records = [
  ...people.map(p => ({
    ...p,
    category: p.type === 'Group' ? 'group' : 'person',
    entityType: p.type,
  })),
  ...places.map(p => ({ ...p, category: 'place', entityType: 'Place' })),
  ...other.map(p => ({ ...p, category: 'other', entityType: p.kind })),
]
// A place named after a person shares the person's id (the city Enoch, the rocks Oreb and Zeeb):
// the place keeps its own record under a distinct name. Family links only name people.
const personIds = new Set(people.map(p => p.id))
for (const record of records)
  record.uniqueName =
    record.category === 'place' && personIds.has(record.id) ? `${record.id}-place` : record.id
const ids = new Map(records.map((record, index) => [record.uniqueName, index + 1]))
if (ids.size !== records.length) throw new Error('Duplicate entity ids')

await mkdir(output, { recursive: true })
await rm(join(output, file), { force: true })
const db = new DatabaseSync(join(output, file))
db.exec(`
  CREATE TABLE EntityMeta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
  CREATE TABLE Entities (
    id INTEGER PRIMARY KEY, uniqueName TEXT NOT NULL, uStrong TEXT NOT NULL,
    displayName TEXT NOT NULL, category TEXT NOT NULL, type TEXT NOT NULL,
    description TEXT NOT NULL, summaryHtml TEXT NOT NULL, briefest TEXT NOT NULL,
    brief TEXT NOT NULL, shortDescription TEXT NOT NULL, articleHtml TEXT NOT NULL);
  CREATE TABLE EntityTranslations (
    id INTEGER PRIMARY KEY, entityId INTEGER NOT NULL, language TEXT NOT NULL,
    displayName TEXT NOT NULL, description TEXT NOT NULL, summaryHtml TEXT NOT NULL,
    briefest TEXT NOT NULL, brief TEXT NOT NULL, shortDescription TEXT NOT NULL,
    articleHtml TEXT NOT NULL);
  CREATE TABLE EntityRefs (
    entityId INTEGER NOT NULL, book TEXT NOT NULL, chapter INTEGER NOT NULL,
    verse INTEGER NOT NULL, suffix TEXT NOT NULL, refText TEXT NOT NULL);
  CREATE TABLE EntityRelations (
    fromEntityId INTEGER NOT NULL, relation TEXT NOT NULL, toUniqueName TEXT NOT NULL,
    toEntityId INTEGER, certainty TEXT NOT NULL);
  CREATE TABLE EntityPlaces (
    entityId INTEGER NOT NULL, openBibleName TEXT NOT NULL, googleMapUrl TEXT NOT NULL,
    palopenmapsUrl TEXT NOT NULL, latitude REAL, longitude REAL, area TEXT NOT NULL);
`)
const insertEntity = db.prepare('INSERT INTO Entities VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
const insertRef = db.prepare('INSERT INTO EntityRefs VALUES (?,?,?,?,?,?)')
const insertRelation = db.prepare('INSERT INTO EntityRelations VALUES (?,?,?,?,?)')
const insertPlace = db.prepare('INSERT INTO EntityPlaces VALUES (?,?,?,?,?,?,?)')
let refCount = 0,
  relationCount = 0
db.exec('BEGIN')
for (const record of records) {
  const id = ids.get(record.uniqueName)
  const otherNames = (record.names ?? []).filter(name => name !== record.name)
  const article = [
    `<p>${html(record.description)}</p>`,
    otherNames.length ? `<p>Also called ${otherNames.map(html).join(', ')}.</p>` : '',
    record.pin?.url
      ? `<p><a href="${html(record.pin.url)}">Map location (${html(record.pin.label)})</a></p>`
      : '',
  ].join('')
  insertEntity.run(
    id,
    record.uniqueName,
    '',
    record.name,
    record.category,
    record.entityType,
    record.description,
    `<p>${html(record.description)}</p>`,
    record.name,
    record.description,
    record.description,
    article
  )
  for (const ref of new Set(record.verses)) {
    const { book, chapter, verse } = reference(ref)
    insertRef.run(
      id,
      bookCodes[book.id - 1],
      chapter,
      verse,
      '',
      `${book.name} ${chapter}:${verse}`
    )
    refCount++
  }
  for (const [field, relation] of RELATIONS) {
    for (const link of record[field] ?? []) {
      if (!ids.has(link.id)) throw new Error(`${record.id} links to unknown ${link.id}`)
      const certainty = EVIDENCE[link.evidence]
      if (!certainty) throw new Error(`${record.id} has unknown evidence ${link.evidence}`)
      insertRelation.run(id, relation, link.id, ids.get(link.id), certainty)
      relationCount++
    }
  }
  if (record.category === 'place') {
    const pin = record.pin
    insertPlace.run(id, record.name, '', '', pin?.lat ?? null, pin?.lon ?? null, '')
  }
}
const revision = `cj-entities-${hash(JSON.stringify({ people, places, other, bookCodes }))}`
const insertMeta = db.prepare('INSERT INTO EntityMeta VALUES (?,?)')
for (const [key, value] of Object.entries({
  moduleKind: 'entities',
  resourceIdentity: 'strong-lexicon:entities',
  resourceRevision: revision,
  moduleSchemaVersion: '1',
  sourceCommit,
  source: 'CyberJudah KJV people, places and other names (data/*-kjv)',
}))
  insertMeta.run(key, value)
db.exec('COMMIT')
db.exec('VACUUM')
db.close()

execFileSync('python3', [
  '-c',
  `import zipfile,sys,pathlib\np=pathlib.Path(sys.argv[1])\nwith zipfile.ZipFile(str(p)+'.zip','w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:\n info=zipfile.ZipInfo(p.name,(2026,10,25,0,0,0)); info.compress_type=zipfile.ZIP_DEFLATED; z.writestr(info,p.read_bytes())`,
  join(output, file),
])
const data = await readFile(join(output, file)),
  archive = await readFile(join(output, file + '.zip'))
const catalogPath = join(app, 'src/assets/cyberjudah/offline-catalog.json')
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'))
const origin = new URL(catalog.resources['bible:KJV'].url).origin
catalog.resources['strong-lexicon:entities'] = {
  id: 'strong-lexicon:entities',
  url: `${origin}/offline/${file}.zip?sha256=${hash(archive)}`,
  file: file + '.zip',
  entry: file,
  entries: { canonical: { entry: file, sha256: hash(data), bytes: data.length } },
  archiveSha256: hash(archive),
  archiveBytes: archive.length,
  contentSha256: hash(data),
  contentBytes: data.length,
  installedBytes: data.length,
  peakInstallationBytes: data.length * 2 + archive.length,
  strategy: 'archive-extract',
  resourceRevision: revision,
}
catalog.resourceCount = Object.keys(catalog.resources).length
await writeFile(catalogPath, JSON.stringify(catalog, null, 2) + '\n')
await writeFile(join(output, 'catalog.json'), JSON.stringify(catalog))
await rm(join(output, file))
console.log(
  JSON.stringify({
    sourceCommit,
    people: people.length,
    places: places.length,
    other: other.length,
    refs: refCount,
    relations: relationCount,
    archiveBytes: archive.length,
    revision,
  })
)
