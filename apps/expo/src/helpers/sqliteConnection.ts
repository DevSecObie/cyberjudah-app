import * as SQLite from 'expo-sqlite'

export type SQLiteDatabase = SQLite.SQLiteDatabase

/**
 * Expo's blanket statement cleanup also finalizes statements owned by FTS5.
 * SQLite then finalizes them again when closing, crashing the native process.
 * Keep ownership with SQLite: our get/run helpers finalize their own statements
 * in finally blocks. Explicit prepared statements must do the same.
 * https://github.com/expo/expo/issues/38168
 */
export const openSQLiteDatabase = (
  name: string,
  options: SQLite.SQLiteOpenOptions = {},
  directory?: string
): Promise<SQLite.SQLiteDatabase> =>
  SQLite.openDatabaseAsync(
    name,
    { ...options, finalizeUnusedStatementsBeforeClosing: false },
    directory
  )
