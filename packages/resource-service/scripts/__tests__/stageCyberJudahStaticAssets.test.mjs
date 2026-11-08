import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, writeFile, readFile, symlink } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { stageCyberJudahStaticAssets } from '../stageCyberJudahStaticAssets.mjs'

const serviceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const fixture = async () => {
  const root = path.join(serviceRoot, '.local/cyberjudah-static-tests', randomUUID())
  await mkdir(path.join(root, 'apps/expo/public/offline/bibles'), { recursive: true })
  const file = path.join(root, 'apps/expo/public/offline/bibles/fixture.zip')
  const zipped = spawnSync('python3', [
    '-c',
    'import sys,zipfile\ni=zipfile.ZipInfo("fixture.json");i.external_attr=0o100644<<16\nwith zipfile.ZipFile(sys.argv[1],"w") as z:z.writestr(i,b"fixture")',
    file,
  ])
  assert.equal(zipped.status, 0)
  const bytes = await readFile(file)
  const entry = {
    id: 'bible:TEST',
    file: 'bibles/fixture.zip',
    entry: 'fixture.json',
    archiveSha256: sha256(bytes),
    archiveBytes: bytes.length,
    contentSha256: sha256('fixture'),
    contentBytes: 7,
    strategy: 'archive-extract',
    url: `https://api.cyberjudah.io/v1/offline-artifacts/bibles/fixture.zip?sha256=${sha256(bytes)}`,
  }
  const catalog = {
    schemaVersion: 1,
    resourceCount: 2,
    resources: { 'bible:TEST': entry, 'bible:MISSING': { ...entry, id: 'bible:MISSING' } },
  }
  const source = {
    bibles: [
      {
        catalogId: entry.id,
        file: entry.file,
        source: { page: 'https://example.org/source' },
        licence: 'Public domain',
        credit: 'Fixture source',
        excluded: false,
      },
    ],
  }
  const ledger = {
    schemaVersion: 1,
    approvedResourceIds: ['bible:TEST'],
    archivePins: { 'bible:TEST': { sha256: entry.archiveSha256, bytes: entry.archiveBytes } },
    catalogSource: 'catalog.json',
    freeBibleSources: 'sources.json',
    resources: [],
    cdn: [],
  }
  const config = { name: 'fixture', main: 'worker.ts', assets: {} }
  for (const [name, value] of Object.entries({
    'catalog.json': catalog,
    'sources.json': source,
    'ledger.json': ledger,
    'config.json': config,
  }))
    await writeFile(path.join(root, name), JSON.stringify(value))
  const stage = () =>
    stageCyberJudahStaticAssets({
      root,
      ledgerPath: path.join(root, 'ledger.json'),
      configPath: path.join(root, 'config.json'),
      outputRoot: path.join(root, 'output'),
    })
  return {
    root,
    file,
    catalog,
    source,
    ledger,
    stage,
    save: (name, value) => writeFile(path.join(root, name), JSON.stringify(value)),
  }
}

test('stages only licensed, exact, regular-file archives and an accurate catalog; output is repeatable', async () => {
  const f = await fixture()
  f.catalog.resources['bible:TEST'].url = f.catalog.resources['bible:TEST'].url.split('?')[0]
  await f.save('catalog.json', f.catalog)
  const first = await f.stage()
  assert.equal(first.resourceCount, 1)
  assert.equal(first.fileCount, 4)
  assert.equal(first.excluded.length, 1)
  const catalog = JSON.parse(
    await readFile(path.join(first.directory, 'assets/__cyberjudah/catalog.json'))
  )
  assert.deepEqual(Object.keys(catalog.resources), ['bible:TEST'])
  assert.equal(catalog.resourceCount, 1)
  assert.equal((await f.stage()).release, first.release)
  const config = JSON.parse(await readFile(first.configPath))
  assert.equal(config.assets.run_worker_first, true)
  assert.equal(config.assets.not_found_handling, 'none')
})

test('refuses checksum or content metadata mismatch rather than publishing broken downloads', async () => {
  const f = await fixture()
  f.catalog.resources['bible:TEST'].archiveSha256 = 'a'.repeat(64)
  await f.save('catalog.json', f.catalog)
  await assert.rejects(f.stage(), /Approved archive pin mismatch/u)
  const corrupt = await fixture()
  await writeFile(corrupt.file, 'bad archive bytes')
  await assert.rejects(corrupt.stage(), /archive size\/SHA mismatch/u)
  const g = await fixture()
  g.catalog.resources['bible:TEST'].contentSha256 = 'b'.repeat(64)
  await g.save('catalog.json', g.catalog)
  await assert.rejects(g.stage(), /Archive validation failed/u)
})

test('excludes withdrawn sources, rejects missing credits and prevents repository path escape', async () => {
  const f = await fixture()
  f.source.bibles[0].excluded = 'withdrawn'
  await f.save('sources.json', f.source)
  await assert.rejects(f.stage(), /No validated resources/u)
  const g = await fixture()
  g.source.bibles[0].credit = ''
  await g.save('sources.json', g.source)
  await assert.rejects(g.stage(), /licence, source and credit/u)
  const h = await fixture()
  h.ledger.catalogSource = '../outside.json'
  await h.save('ledger.json', h.ledger)
  await assert.rejects(h.stage(), /Unsafe resource path/u)
  const j = await fixture()
  await symlink(path.join(j.root, '../outside.json'), path.join(j.root, 'outside-link.json'))
  j.ledger.catalogSource = 'outside-link.json'
  await j.save('ledger.json', j.ledger)
  await assert.rejects(j.stage())
})
