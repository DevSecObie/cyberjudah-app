import NetInfo from '@react-native-community/netinfo'
import * as FileSystem from 'expo-file-system/legacy'
import { openSQLiteDatabase, type SQLiteDatabase } from '~helpers/sqliteConnection'
import { useEffect, useSyncExternalStore } from 'react'
import { AppState, Platform } from 'react-native'
import { storage } from '~helpers/storage'
import {
  installAtomicResourceFile,
  restoreOrphanedResourceBackup,
} from '~helpers/atomicResourceFile'
import { ftsQuery, momentOf } from './classIndexQuery'

// The class search kept on the phone: the library every notes publish builds (all the notes, with
// a full-text index), downloaded once from data.cyberjudah.io and searched here in milliseconds,
// offline too. The data server sends it gzipped and the download unpacks it on the way in.

const URL = 'https://data.cyberjudah.io/library.sqlite'
const DIRECTORY = `${FileSystem.documentDirectory}SQLite/cyberjudah`
const NAME = 'library.sqlite'
const FILE = `${DIRECTORY}/${NAME}`
const PART = `${DIRECTORY}/${NAME}.part`
const ETAG_KEY = 'cyberjudah.classIndex.etag'
const CHECKED_KEY = 'cyberjudah.classIndex.checkedAt'
const CHECK_EVERY_MS = 12 * 60 * 60 * 1000
/** The download's size, for asking first: the library as the data server sends it. */
export const CLASS_INDEX_DOWNLOAD_MB = 56

export type ClassIndexState =
  | { status: 'unknown' | 'absent' | 'ready' }
  /** `installed`: an older copy is still here and searched until the new one replaces it. */
  | { status: 'downloading'; progress: number; installed: boolean }
  | { status: 'failed'; error: string }

let state: ClassIndexState = { status: 'unknown' }
const listeners = new Set<() => void>()
const setState = (next: ClassIndexState) => {
  state = next
  listeners.forEach(listener => listener())
}
let database: Promise<SQLiteDatabase> | null = null
let downloadInFlight: Promise<void> | undefined

// The server may send the same version's ETag weak or strong (W/"…"), depending on whether the
// response was compressed on the way: compare the tag itself.
const sameVersion = (etag?: string | null) => (etag ?? '').replace(/^W\//, '').trim()
const headerOf = (headers: Record<string, string> | undefined, name: string) =>
  Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === name)?.[1]

/** Whether the classes can be searched on this phone now, while an update downloads too. */
export const isClassIndexSearchable = (current: ClassIndexState) =>
  current.status === 'ready' || (current.status === 'downloading' && current.installed)

const open = () =>
  (database ??= openSQLiteDatabase(NAME, { useNewConnection: true }, DIRECTORY).then(async db => {
    await db.execAsync('PRAGMA query_only = ON;')
    return db
  }))

/** Whether the library is on this phone (checked once, then kept in step with downloads). */
export const refreshClassIndexState = async () => {
  if (state.status === 'downloading') return state
  // The web app has no file system to keep the library in: it always searches online.
  if (Platform.OS === 'web') {
    setState({ status: 'absent' })
    return state
  }
  await restoreOrphanedResourceBackup(FILE, `${FILE}.backup`)
  const info = await FileSystem.getInfoAsync(FILE)
  setState({ status: info.exists ? 'ready' : 'absent' })
  return state
}

/** Downloads (or replaces) the library, unpacked, and checks it opens before using it. */
const performClassIndexDownload = async () => {
  const installed = (await FileSystem.getInfoAsync(FILE)).exists
  setState({ status: 'downloading', progress: 0, installed })
  try {
    await FileSystem.makeDirectoryAsync(DIRECTORY, { intermediates: true }).catch(() => {})
    await FileSystem.deleteAsync(PART, { idempotent: true })
    const download = FileSystem.createDownloadResumable(URL, PART, {}, ({ totalBytesWritten }) =>
      setState({
        status: 'downloading',
        installed,
        // The bytes come in unpacked, about three times the size sent.
        progress: Math.min(0.99, totalBytesWritten / (CLASS_INDEX_DOWNLOAD_MB * 2.9 * 1048576)),
      })
    )
    const result = await download.downloadAsync()
    if (!result || result.status !== 200) throw new Error(`HTTP ${result?.status ?? 'none'}`)
    const check = await openSQLiteDatabase(`${NAME}.part`, { useNewConnection: true }, DIRECTORY)
    try {
      const row = await check.getFirstAsync<{ n: number }>(
        "SELECT count(*) AS n FROM notes WHERE kind IN ('class', 'captains', 'history')"
      )
      if (!row?.n) throw new Error('The library has no classes')
    } finally {
      await check.closeAsync()
    }
    await installAtomicResourceFile({
      candidatePath: PART,
      destinationPath: FILE,
      beforeSwap: async () => {
        const previous = database
        database = null
        if (previous) await (await previous).closeAsync()
      },
    })
    const etag = sameVersion(headerOf(result.headers, 'etag'))
    if (etag) storage.set(ETAG_KEY, etag)
    storage.set(CHECKED_KEY, Date.now())
    setState({ status: 'ready' })
  } catch (error) {
    await FileSystem.deleteAsync(PART, { idempotent: true }).catch(() => {})
    setState({ status: 'failed', error: (error as Error).message })
    void refreshClassIndexState()
  }
}

export const downloadClassIndex = (): Promise<void> => {
  // Reserve the job before the first filesystem await: simultaneous foreground events
  // must not both write or remove the same partial download.
  if (!downloadInFlight) {
    downloadInFlight = performClassIndexDownload().finally(() => {
      downloadInFlight = undefined
    })
  }
  return downloadInFlight
}

/** Removes the library from this phone. */
export const removeClassIndex = async () => {
  if (database) {
    await (await database).closeAsync().catch(() => {})
    database = null
  }
  await FileSystem.deleteAsync(FILE, { idempotent: true })
  storage.remove(ETAG_KEY)
  setState({ status: 'absent' })
}

/**
 * Whether a newer library has been published since this one: a light check (its ETag), at most
 * twice a day unless asked now.
 */
export const isClassIndexOutdated = async ({ now = false } = {}): Promise<boolean> => {
  const last = storage.getNumber(CHECKED_KEY) ?? 0
  if (!now && Date.now() - last < CHECK_EVERY_MS) return false
  try {
    const response = await fetch(URL, { method: 'HEAD' })
    storage.set(CHECKED_KEY, Date.now())
    const etag = sameVersion(response.headers.get('etag'))
    if (!etag) return false
    const kept = storage.getString(ETAG_KEY)
    // A copy downloaded before its version was recorded: take this as its version, not a reason
    // to download it all again.
    if (!kept) {
      storage.set(ETAG_KEY, etag)
      return false
    }
    return sameVersion(kept) !== etag
  } catch {
    return false
  }
}

/** The library's state, for the screens that offer it and search it. */
export const useClassIndexState = () =>
  useSyncExternalStore(
    listener => {
      listeners.add(listener)
      if (state.status === 'unknown') void refreshClassIndexState()
      return () => listeners.delete(listener)
    },
    () => state
  )

export type ClassIndexHit = {
  url: string
  kind: string
  title: string
  date: string
  teacher: string
  videoId: string
  snippet: string
  start?: number
}

/** The classes whose notes say the words, best first, from the library on this phone. */
export const searchClassIndex = async (query: string, limit = 40): Promise<ClassIndexHit[]> => {
  const match = ftsQuery(query)
  if (!match) return []
  const db = await open()
  const rows = await db.getAllAsync<{
    url: string
    kind: string
    title: string
    date: string | null
    teacher: string | null
    video_id: string | null
    snippet: string
    body: string
  }>(
    `SELECT n.url, n.kind, n.title, n.date, n.teacher, n.video_id, n.body,
            snippet(notes_fts, 1, '', '', '…', 24) AS snippet
       FROM notes_fts JOIN notes n ON n.id = notes_fts.rowid
      WHERE notes_fts MATCH ? AND n.kind IN ('class', 'captains', 'history')
      ORDER BY bm25(notes_fts, 4, 1)
      LIMIT ?`,
    [match, limit]
  )
  return rows.map(row => ({
    url: row.url,
    kind: row.kind,
    title: row.title,
    date: row.date ?? '',
    teacher: row.teacher ?? '',
    videoId: row.video_id ?? '',
    snippet: row.snippet,
    start: momentOf(row.body, query),
  }))
}

/**
 * Like a game's update when it opens: each time the app opens or comes back, the classes are
 * downloaded if they are not on this phone yet, or again if newer ones have been published. Only
 * on Wi-Fi; on mobile data, Downloads in More offers it instead.
 */
export const keepClassIndexCurrent = async () => {
  if (Platform.OS === 'web') return
  const network = await NetInfo.fetch()
  if (!network.isConnected || (network.type !== 'wifi' && network.type !== 'ethernet')) return
  const current = await refreshClassIndexState()
  if (current.status === 'downloading') return
  if (current.status !== 'ready' || (await isClassIndexOutdated({ now: true })))
    await downloadClassIndex()
}

/** Keeps the classes current while the app runs: on opening, and each time it comes back. */
export const useKeepClassIndexCurrent = (enabled: boolean) =>
  useEffect(() => {
    if (!enabled) return
    void keepClassIndexCurrent()
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active') void keepClassIndexCurrent()
    })
    return () => subscription.remove()
  }, [enabled])
