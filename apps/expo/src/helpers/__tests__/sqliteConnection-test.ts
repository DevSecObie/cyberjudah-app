import { openSQLiteDatabase } from '../sqliteConnection'

const mockOpenDatabaseAsync = jest.fn(async (..._args: unknown[]) => ({ closeAsync: jest.fn() }))

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: (...args: unknown[]) => mockOpenDatabaseAsync(...args),
}))

describe('FTS-safe SQLite connections', () => {
  beforeEach(() => jest.clearAllMocks())

  it('leaves FTS-owned statements to SQLite when closing a default connection', async () => {
    const database = await openSQLiteDatabase('dictionary.sqlite')
    expect(mockOpenDatabaseAsync).toHaveBeenCalledWith(
      'dictionary.sqlite',
      { finalizeUnusedStatementsBeforeClosing: false },
      undefined
    )
    await database.closeAsync()
    expect(database.closeAsync).toHaveBeenCalledTimes(1)
  })

  it('preserves isolated validation connections and their location without unsafe cleanup', async () => {
    await openSQLiteDatabase(
      'library.sqlite.part',
      {
        useNewConnection: true,
        enableChangeListener: true,
        finalizeUnusedStatementsBeforeClosing: true,
      },
      '/documents/SQLite/cyberjudah'
    )
    expect(mockOpenDatabaseAsync).toHaveBeenCalledWith(
      'library.sqlite.part',
      {
        useNewConnection: true,
        enableChangeListener: true,
        finalizeUnusedStatementsBeforeClosing: false,
      },
      '/documents/SQLite/cyberjudah'
    )
  })
})
