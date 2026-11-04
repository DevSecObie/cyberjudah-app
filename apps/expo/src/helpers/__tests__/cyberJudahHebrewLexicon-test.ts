/* eslint-disable import/first */

jest.mock('expo-file-system/legacy', () => ({}))
jest.mock('react-native-zip-archive', () => ({ unzip: jest.fn() }))
jest.mock('../atomicResourceFile', () => ({
  installAtomicResourceFile: jest.fn(),
  restoreOrphanedResourceBackup: jest.fn(),
}))
jest.mock('../databaseTypes', () => ({ getSharedSqliteDirPath: () => '/sqlite' }))
jest.mock('../downloadResourceArtifact', () => ({ downloadResourceArtifact: jest.fn() }))
jest.mock('../fileIntegrity', () => ({ toNativeFilePath: (path: string) => path }))
jest.mock('../firebase', () => ({ cdnUrl: (path: string) => `https://assets.test/${path}` }))
jest.mock('../sqlite', () => ({ openSQLiteDatabase: jest.fn() }))

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import catalog from '../../assets/cyberjudah/offline-catalog.json'
import type { SQLiteDatabase } from '../sqlite'

const entry = catalog.resources['strong-lexicon:resources']
const archive = resolve(__dirname, '../../../public/offline', entry.file)

const openArchive = () => {
  const directory = mkdtempSync(join(tmpdir(), 'cj-bdb-'))
  execFileSync('python3', [
    '-c',
    'import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])',
    archive,
    directory,
  ])
  const path = join(directory, entry.entry)
  expect(createHash('sha256').update(readFileSync(path)).digest('hex')).toBe(entry.contentSha256)
  const database = new DatabaseSync(path)
  return {
    database,
    adapter: {
      getFirstAsync: async (sql: string, params: unknown[] = []) =>
        database.prepare(sql).get(...(params as never[])),
      getAllAsync: async (sql: string, params: unknown[] = []) =>
        database.prepare(sql).all(...(params as never[])),
      execAsync: async (sql: string) => database.exec(sql),
    } as unknown as SQLiteDatabase,
  }
}

describe('CyberJudah Hebrew lexicon module (Brown-Driver-Briggs)', () => {
  const profile = process.env.EXPO_PUBLIC_RESOURCE_PROFILE
  afterEach(() => {
    process.env.EXPO_PUBLIC_RESOURCE_PROFILE = profile
  })

  it('matches its catalog archive and passes the archive check the app runs', () => {
    const bytes = readFileSync(archive)
    expect(bytes.length).toBe(entry.archiveBytes)
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.archiveSha256)
    const { validateBoundedZipArchive } = jest.requireActual('../zipArchiveValidation')
    expect(() =>
      validateBoundedZipArchive(new Uint8Array(bytes), {
        entry: entry.entry,
        archiveBytes: entry.archiveBytes,
        contentBytes: entry.contentBytes,
      })
    ).not.toThrow()
  })

  it('passes the app validation without a Strong lexicon core', async () => {
    process.env.EXPO_PUBLIC_RESOURCE_PROFILE = 'cyberjudah'
    const { adapter } = openArchive()
    await jest.isolateModulesAsync(async () => {
      const { validateStrongLexiconModuleDatabase } = await import('../strongLexiconModules')
      await expect(
        validateStrongLexiconModuleDatabase('resources', adapter, async () => ({
          status: 'missing',
          moduleId: 'core',
        }))
      ).resolves.toMatchObject({ status: 'available', revision: entry.resourceRevision })
    })
  })

  it('ties each entry to the Hebrew Strong number of the English lexicon, with its credit', () => {
    const { database } = openArchive()
    const row = database
      .prepare('SELECT source, contentHtml FROM LexiconResources WHERE stepEntryId=?')
      .get(7225) as { source: string; contentHtml: string }
    expect(row.source).toBe('BDB')
    expect(row.contentHtml).toContain('beginning')
    expect(row.contentHtml).toContain('Open Scriptures Hebrew Bible Project')
  })
})

describe('CyberJudah English Strong lexicon module', () => {
  it('passes the archive check the app runs before installing', () => {
    const simple = catalog.resources['strong-lexicon:simple-en']
    const bytes = readFileSync(resolve(__dirname, '../../../public/offline', simple.file))
    const { validateBoundedZipArchive } = jest.requireActual('../zipArchiveValidation')
    expect(() =>
      validateBoundedZipArchive(new Uint8Array(bytes), {
        entry: simple.entry,
        archiveBytes: simple.archiveBytes,
        contentBytes: simple.contentBytes,
      })
    ).not.toThrow()
  })
})
