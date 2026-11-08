import { createHash } from 'node:crypto'
import { Buffer } from 'node:buffer'
import { readFile, writeFile, mkdir, realpath, readdir } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const serviceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = path.resolve(serviceRoot, '../..')
const maxBytes = 25 * 1024 * 1024
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const json = file => readFile(file, 'utf8').then(JSON.parse)
const safeRelative = value => {
  if (
    typeof value !== 'string' ||
    !value ||
    value.startsWith('/') ||
    value.includes('\\') ||
    value.split('/').some(p => !p || p === '.' || p === '..')
  )
    throw new Error(`Unsafe resource path: ${value}`)
  return value
}
const requireRights = rights => {
  if (
    !rights ||
    !['source', 'credit'].every(key => typeof rights[key] === 'string' && rights[key].trim()) ||
    !(
      (typeof rights.licence === 'string' && rights.licence.trim()) ||
      (rights.licence === null &&
        typeof rights.ownerAuthorisation === 'string' &&
        rights.ownerAuthorisation.trim())
    )
  )
    throw new Error('Redistribution licence, source and credit are required')
  if (!/^https:\/\//u.test(rights.source)) throw new Error('Licence source must be HTTPS')
  return rights
}
const repositoryFile = async (root, relative) => {
  const file = path.join(root, safeRelative(relative))
  const actual = await realpath(file)
  if (!actual.startsWith(`${await realpath(root)}${path.sep}`))
    throw new Error('Resource escapes repository')
  return actual
}

export const validateArchive = (file, entry) => {
  const expected = Object.fromEntries(
    Object.values(
      entry.entries ?? {
        canonical: { entry: entry.entry, sha256: entry.contentSha256, bytes: entry.contentBytes },
      }
    ).map(value => [safeRelative(value.entry), { sha256: value.sha256, bytes: value.bytes }])
  )
  if (!expected[entry.entry]) throw new Error(`Missing canonical ZIP entry: ${entry.id}`)
  if (
    expected[entry.entry].sha256 !== entry.contentSha256 ||
    expected[entry.entry].bytes !== entry.contentBytes
  )
    throw new Error(`Canonical content metadata mismatch: ${entry.id}`)
  const result = spawnSync(
    'python3',
    [
      '-c',
      'import sys,json,zipfile,hashlib,stat\n' +
        'expected=json.load(sys.stdin)\n' +
        'with zipfile.ZipFile(sys.argv[1]) as z:\n' +
        ' assert len(z.namelist())==len(set(z.namelist())), "duplicate ZIP members"\n' +
        ' assert set(z.namelist())==set(expected), "ZIP member mismatch"\n' +
        ' for name,meta in expected.items():\n' +
        '  info=z.getinfo(name)\n' +
        '  assert stat.S_ISREG(info.external_attr >> 16), "ZIP member must be a regular file"\n' +
        '  assert info.file_size==meta["bytes"], "entry size mismatch"\n' +
        '  assert info.file_size<=536870912, "entry exceeds validation budget"\n' +
        '  assert hashlib.sha256(z.read(name)).hexdigest()==meta["sha256"], "entry SHA mismatch"\n',
      file,
    ],
    { input: JSON.stringify(expected), encoding: 'utf8', maxBuffer: 1024 * 1024 }
  )
  if (result.status !== 0) throw new Error(`Archive validation failed: ${entry.id}`)
}

export async function stageCyberJudahStaticAssets({
  root = repositoryRoot,
  ledgerPath = path.join(serviceRoot, 'cyberjudah-static-resources.json'),
  configPath = path.join(serviceRoot, 'wrangler.cyberjudah.json'),
  outputRoot = path.join(serviceRoot, '.local/cyberjudah-static'),
} = {}) {
  const ledger = await json(ledgerPath)
  if (ledger.schemaVersion !== 1) throw new Error('Unknown rights ledger version')
  if (!Array.isArray(ledger.approvedResourceIds) || ledger.approvedResourceIds.length === 0)
    throw new Error('Explicit approved resource allowlist required')
  const approvedIds = new Set(ledger.approvedResourceIds)
  if (approvedIds.size !== ledger.approvedResourceIds.length)
    throw new Error('Duplicate approved identity')
  const catalog = await json(await repositoryFile(root, ledger.catalogSource))
  const sources = await json(await repositoryFile(root, ledger.freeBibleSources))
  const candidates = [
    ...sources.bibles
      .filter(source => !source.excluded)
      .map(source => ({
        resourceId: source.catalogId,
        sourcePath: `apps/expo/public/offline/${safeRelative(source.file)}`,
        rights: { licence: source.licence, source: source.source.page, credit: source.credit },
      })),
    ...ledger.resources,
  ]
  const eligible = new Map()
  for (const item of candidates) {
    if (eligible.has(item.resourceId))
      throw new Error(`Duplicate rights record: ${item.resourceId}`)
    requireRights(item.rights)
    eligible.set(item.resourceId, item)
  }
  const selected = {}
  const artifacts = {}
  const cdn = {}
  const outputs = new Map()
  const excluded = []
  const rights = []
  const add = (bytes, basename) => {
    if (bytes.length > maxBytes) throw new Error(`Static asset exceeds 25 MiB: ${basename}`)
    const hash = sha256(bytes)
    const target = `/__cyberjudah/files/${hash}/${path.basename(basename)}`
    outputs.set(target, bytes)
    return { target, sha256: hash, bytes: bytes.length }
  }
  for (const [id, entry] of Object.entries(catalog.resources)) {
    if (!approvedIds.has(id)) {
      excluded.push({ id, reason: 'Not in the approved rollout allowlist' })
      continue
    }
    const item = eligible.get(id)
    if (!item) {
      excluded.push({ id, reason: 'No approved redistribution record' })
      continue
    }
    let file
    try {
      file = await repositoryFile(root, item.sourcePath)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      excluded.push({ id, reason: 'Approved source archive not present' })
      continue
    }
    if (entry.id !== id) throw new Error(`Catalog identity mismatch: ${id}`)
    const pin = ledger.archivePins?.[id]
    if (!pin || entry.archiveSha256 !== pin.sha256 || entry.archiveBytes !== pin.bytes)
      throw new Error(`Approved archive pin mismatch: ${id}`)
    const relative = safeRelative(entry.file)
    const bytes = await readFile(file)
    if (bytes.length !== entry.archiveBytes || sha256(bytes) !== entry.archiveSha256)
      throw new Error(`Catalog archive size/SHA mismatch: ${id}`)
    if (!['archive-extract', 'sqlite-import'].includes(entry.strategy))
      throw new Error(`Unsupported archive strategy: ${id}`)
    validateArchive(file, entry)
    const route = `/v1/offline-artifacts/${relative}`
    const url = new URL(entry.url)
    if (
      url.origin !== 'https://api.cyberjudah.io' ||
      url.pathname !== route ||
      (url.searchParams.has('sha256') && url.searchParams.get('sha256') !== entry.archiveSha256)
    )
      throw new Error(`Catalog URL mismatch: ${id}`)
    if (artifacts[route]) throw new Error(`Duplicate artifact route: ${route}`)
    artifacts[route] = {
      ...add(bytes, relative),
      resourceId: id,
      ...item.rights,
      ...(item.approvalEvidence ? { approvalEvidence: item.approvalEvidence } : {}),
    }
    // No unvalidated encrypted fallback is advertised by the staged catalog.
    const { encryptedArchive: _encrypted, ...plainEntry } = entry
    selected[id] = plainEntry
    rights.push({
      resourceId: id,
      file: relative,
      archiveSha256: entry.archiveSha256,
      ...item.rights,
      ...(item.approvalEvidence ? { approvalEvidence: item.approvalEvidence } : {}),
    })
  }
  for (const item of ledger.cdn) {
    requireRights(item.rights)
    if (!['assets.cyberjudah.io', 'media.cyberjudah.io'].includes(item.host))
      throw new Error('Unapproved CDN hostname')
    const route = `/${safeRelative(item.path)}`
    const bytes = await readFile(await repositoryFile(root, item.sourcePath))
    if (sha256(bytes) !== item.sha256 || bytes.length !== item.bytes)
      throw new Error(`CDN size/SHA mismatch: ${route}`)
    const key = `${item.host}${route}`
    if (cdn[key]) throw new Error(`Duplicate CDN path: ${key}`)
    cdn[key] = add(bytes, item.path)
    rights.push({ host: item.host, file: item.path, archiveSha256: item.sha256, ...item.rights })
  }
  if (Object.keys(selected).length === 0) throw new Error('No validated resources to publish')
  const publishedCatalog = {
    ...catalog,
    resourceCount: Object.keys(selected).length,
    resources: selected,
  }
  const release = sha256(JSON.stringify({ catalog: publishedCatalog, rights, cdn }))
  const directory = path.join(outputRoot, release)
  const assetsDirectory = path.join(directory, 'assets')
  const manifest = {
    schemaVersion: 1,
    release,
    catalogTarget: '/__cyberjudah/catalog.json',
    artifacts,
    cdn,
  }
  outputs.set(
    '/__cyberjudah/catalog.json',
    Buffer.from(`${JSON.stringify(publishedCatalog, null, 2)}\n`)
  )
  outputs.set('/__cyberjudah/manifest.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`))
  outputs.set('/__cyberjudah/rights.json', Buffer.from(`${JSON.stringify(rights, null, 2)}\n`))
  if (outputs.size > 20_000) throw new Error('Static file count exceeds Free plan limit')
  for (const [target, bytes] of outputs) {
    if (bytes.length > maxBytes) throw new Error(`Static file exceeds 25 MiB: ${target}`)
    const destination = path.join(assetsDirectory, target)
    await mkdir(path.dirname(destination), { recursive: true })
    try {
      if (!(await readFile(destination)).equals(bytes))
        throw new Error('Immutable staging content changed')
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    await writeFile(destination, bytes)
  }
  const config = await json(configPath)
  config.main = path.resolve(path.dirname(configPath), config.main)
  config.assets.directory = assetsDirectory
  config.assets.run_worker_first = true
  config.assets.not_found_handling = 'none'
  config.assets.html_handling = 'none'
  await writeFile(path.join(directory, 'wrangler.json'), `${JSON.stringify(config, null, 2)}\n`)
  const enumerate = async folder =>
    (
      await Promise.all(
        (await readdir(folder, { withFileTypes: true })).map(async entry =>
          entry.isDirectory()
            ? enumerate(path.join(folder, entry.name))
            : [path.join(folder, entry.name)]
        )
      )
    ).flat()
  const actualFiles = await enumerate(assetsDirectory)
  if (actualFiles.length !== outputs.size)
    throw new Error('Unexpected file in immutable staging directory')
  const report = {
    release,
    directory,
    configPath: path.join(directory, 'wrangler.json'),
    resourceCount: Object.keys(selected).length,
    fileCount: outputs.size,
    totalBytes: [...outputs.values()].reduce((sum, bytes) => sum + bytes.length, 0),
    files: [...outputs].map(([target, bytes]) => ({
      target,
      bytes: bytes.length,
      sha256: sha256(bytes),
    })),
    rights,
    excluded,
  }
  await writeFile(path.join(directory, 'release.json'), `${JSON.stringify(report, null, 2)}\n`)
  return report
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await stageCyberJudahStaticAssets()
  console.log(JSON.stringify({ ...report, files: undefined, rights: undefined }, null, 2))
}
