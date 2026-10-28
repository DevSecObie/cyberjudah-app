// Import the versioned projection produced by cyberjudah-telegram/bot/scripts/build-bs-timeline.mjs.
// Keep Bible Strong's geometry, resource API and optional native Offline-copy formats unchanged.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'
const app = resolve(import.meta.dirname, '..')
if (!process.argv[2]) throw new Error('Pass the generated bs-timeline.json path')
const publication = JSON.parse(await readFile(resolve(process.argv[2]), 'utf8'))
const hash = value => createHash('sha256').update(value).digest('hex')
if (
  publication.revision !==
  `cj-timeline-${hash(JSON.stringify({ geometry: publication.sections, events: publication.events }))}`
)
  throw new Error('Timeline revision mismatch')
const assets = join(app, 'src/assets/cyberjudah')
const output = join(app, 'public/offline')
await mkdir(output, { recursive: true })
await writeFile(join(assets, 'timeline-sections.json'), JSON.stringify(publication.sections) + '\n')
await writeFile(
  join(assets, 'timeline-publication.json'),
  JSON.stringify(
    {
      revision: publication.revision,
      ...publication.source,
      periods: publication.sections.length,
      readableEvents: publication.events.length,
    },
    null,
    2
  ) + '\n'
)
const catalogPath = join(assets, 'offline-catalog.json')
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'))
const content = JSON.stringify(publication.events)
// Both UI languages use the published English text; no translated articles are fabricated.
const file = 'cyberjudah-timeline-en.json.zip'
const entry = 'bible-timeline-events.json'
execFileSync(
  'python3',
  [
    '-c',
    'import zipfile,sys\nwith zipfile.ZipFile(sys.argv[1],"w",compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:\n i=zipfile.ZipInfo(sys.argv[2],(2026,10,28,0,0,0)); i.compress_type=zipfile.ZIP_DEFLATED; z.writestr(i,sys.stdin.buffer.read())',
    join(output, file),
    entry,
  ],
  { input: content }
)
const archive = await readFile(join(output, file))
const bytes = Buffer.byteLength(content)
for (const language of ['en', 'fr']) {
  const id = `database:TIMELINE:${language}`
  catalog.resources[id] = {
    id,
    file,
    entry,
    url: `https://cyberjudah-telegram-staging.oisrae1.workers.dev/offline/${file}?sha256=${hash(archive)}`,
    entries: { canonical: { entry, sha256: hash(content), bytes } },
    archiveSha256: hash(archive),
    archiveBytes: archive.length,
    contentSha256: hash(content),
    contentBytes: bytes,
    installedBytes: bytes,
    peakInstallationBytes: bytes * 2 + archive.length,
    strategy: 'archive-extract',
    resourceRevision: publication.revision,
  }
}
catalog.resourceCount = Object.keys(catalog.resources).length
await writeFile(catalogPath, JSON.stringify(catalog, null, 2) + '\n')
await writeFile(join(output, 'catalog.json'), JSON.stringify(catalog))
console.log(
  JSON.stringify({
    revision: publication.revision,
    periods: publication.sections.length,
    readableEvents: publication.events.length,
    offlineBytes: archive.length,
  })
)
