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
import bookCodes from '../../assets/cyberjudah/entity-book-codes.json'
import type { SQLiteDatabase } from '../sqlite'

const entry = catalog.resources['strong-lexicon:entities']
const archive = resolve(__dirname, '../../../public/offline', entry.file)

const openArchive = () => {
  const directory = mkdtempSync(join(tmpdir(), 'cj-entities-'))
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

const chapterNames = (database: DatabaseSync, book: number, chapter: number) =>
  (
    database
      .prepare(
        `SELECT DISTINCT e.displayName AS name FROM Entities e
           JOIN EntityRefs r ON r.entityId=e.id WHERE r.book=? AND r.chapter=?`
      )
      .all(bookCodes[book - 1], chapter) as { name: string }[]
  ).map(row => row.name)

describe('CyberJudah People module', () => {
  const profile = process.env.EXPO_PUBLIC_RESOURCE_PROFILE
  afterEach(() => {
    process.env.EXPO_PUBLIC_RESOURCE_PROFILE = profile
  })

  it('matches its catalog archive', () => {
    const bytes = readFileSync(archive)
    expect(bytes.length).toBe(entry.archiveBytes)
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.archiveSha256)
  })

  // 304 refused the download with STRONG_LEXICON_ARCHIVE_ENTRY_TYPE_INVALID.
  it('passes the archive check the app runs before installing', () => {
    const { validateBoundedZipArchive } = jest.requireActual('../zipArchiveValidation')
    expect(() =>
      validateBoundedZipArchive(new Uint8Array(readFileSync(archive)), {
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
      const { requiresStrongLexiconCore } = await import('../strongLexiconCore')
      expect(requiresStrongLexiconCore('entities')).toBe(false)
      expect(requiresStrongLexiconCore('resources')).toBe(true)
      await expect(
        validateStrongLexiconModuleDatabase('entities', adapter, async () => ({
          status: 'missing',
          moduleId: 'core',
        }))
      ).resolves.toMatchObject({ status: 'available', revision: entry.resourceRevision })
    })
  })

  it('still pairs Bible Strong’s own People module with its core', async () => {
    process.env.EXPO_PUBLIC_RESOURCE_PROFILE = ''
    await jest.isolateModulesAsync(async () => {
      const { requiresStrongLexiconCore } = await import('../strongLexiconCore')
      expect(requiresStrongLexiconCore('entities')).toBe(true)
    })
  })

  it('names people and places in the Old Testament, New Testament and Apocrypha', () => {
    const { database } = openArchive()
    expect(chapterNames(database, 2, 2)).toEqual(expect.arrayContaining(['Moses']))
    expect(chapterNames(database, 1, 2)).toEqual(expect.arrayContaining(['Adam', 'Eden']))
    expect(chapterNames(database, 40, 1)).toEqual(expect.arrayContaining(['Abraham']))
    expect(chapterNames(database, 80, 2)).toEqual(expect.arrayContaining(['Mattathias']))
  })

  it('keeps the family links the catalog gives, with their evidence', () => {
    const { database } = openArchive()
    const links = database
      .prepare(
        `SELECT r.relation, t.displayName AS target, r.certainty FROM EntityRelations r
           JOIN Entities f ON f.id=r.fromEntityId JOIN Entities t ON t.id=r.toEntityId
          WHERE f.uniqueName='adam-gen-2-19' ORDER BY r.relation, t.displayName`
      )
      .all()
    expect(links).toEqual([
      { relation: 'offspring', target: 'Abel', certainty: 'Scripturally confirmed' },
      { relation: 'offspring', target: 'Cain', certainty: 'Scripturally confirmed' },
      { relation: 'offspring', target: 'Seth', certainty: 'Scripturally confirmed' },
      { relation: 'partner', target: 'Eve', certainty: 'Scripturally confirmed' },
    ])
  })

  it('uses Bible Strong’s book codes for the 66 books', () => {
    const source = readFileSync(
      resolve(__dirname, '../../features/resources/strongLexiconAccess.ts'),
      'utf8'
    )
    const tipnr = [
      ...source.match(/const TIPNR_BOOK_CODES = \[([\s\S]*?)\]/)![1].matchAll(/'([^']+)'/g),
    ].map(match => match[1])
    expect(bookCodes.slice(0, 66)).toEqual(tipnr)
    expect(new Set(bookCodes).size).toBe(81)
  })
})
