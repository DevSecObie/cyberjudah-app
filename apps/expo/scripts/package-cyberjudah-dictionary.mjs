// Publish one of CyberJudah's own dictionaries for offline download, the way Bible Strong ships
// its dictionaries: dictionaries/dictionary-<work>-en.sqlite.zip beside the other offline files,
// listed in the catalog as database:<RESOURCE_ID>:en.
// Usage: node scripts/package-cyberjudah-dictionary.mjs <dictionnaire.sqlite> <work> <RESOURCE_ID>
import { readFile, writeFile, mkdir, copyFile, rm } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
const app = resolve(import.meta.dirname, '..')
const [input, work, resourceId] = process.argv.slice(2)
if (!input || !/^[a-z0-9-]+$/.test(work ?? '') || !/^[A-Z0-9_]+$/.test(resourceId ?? ''))
  throw new Error('Usage: package-cyberjudah-dictionary.mjs <sqlite> <work> <RESOURCE_ID>')
const hash = data => createHash('sha256').update(data).digest('hex')

// The app installs a dictionary only when it has this table and passes an integrity check.
const db = new DatabaseSync(resolve(input), { readOnly: true })
if (db.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok')
  throw new Error('Integrity check failed')
const { entries } = db.prepare('SELECT count(*) AS entries FROM dictionnaire').get()
db.close()

const entry = 'dictionnaire.sqlite'
const file = `dictionaries/dictionary-${work}-en.sqlite.zip`
const output = join(app, 'public/offline')
const staging = join(output, 'dictionaries', entry)
await mkdir(join(output, 'dictionaries'), { recursive: true })
await copyFile(resolve(input), staging)
// The app accepts only a regular-file entry (zipArchiveValidation): mark it as one.
execFileSync('python3', [
  '-c',
  `import zipfile,sys,pathlib\np=pathlib.Path(sys.argv[1])\nwith zipfile.ZipFile(sys.argv[2],'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:\n info=zipfile.ZipInfo(p.name,(2026,10,30,0,0,0)); info.compress_type=zipfile.ZIP_DEFLATED; info.external_attr=0o100644<<16; z.writestr(info,p.read_bytes())`,
  staging,
  join(output, file),
])
const data = await readFile(staging),
  archive = await readFile(join(output, file))
await rm(staging)
// Workers static assets serve files up to 25 MiB.
if (archive.length > 25 * 1024 * 1024) throw new Error(`${file} is over 25 MiB`)

const catalogPath = join(app, 'src/assets/cyberjudah/offline-catalog.json')
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'))
const origin = new URL(catalog.resources['bible:KJV'].url).origin
const id = `database:${resourceId}:en`
catalog.resources[id] = {
  id,
  url: `${origin}/offline/${file}?sha256=${hash(archive)}`,
  file,
  entry,
  entries: { canonical: { entry, sha256: hash(data), bytes: data.length } },
  archiveSha256: hash(archive),
  archiveBytes: archive.length,
  contentSha256: hash(data),
  contentBytes: data.length,
  resourceRevision: `dictionary-${work}-en-${hash(data).slice(0, 20)}`,
  installedBytes: data.length,
  peakInstallationBytes: data.length * 2 + archive.length,
  strategy: 'archive-extract',
}
catalog.resourceCount = Object.keys(catalog.resources).length
catalog.generatedAt = new Date().toISOString()
await writeFile(catalogPath, JSON.stringify(catalog, null, 2) + '\n')
await writeFile(join(output, 'catalog.json'), JSON.stringify(catalog))
console.log(JSON.stringify({ id, file, entries, archiveBytes: archive.length }))
