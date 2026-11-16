import { getCurrentAuthUser } from '~helpers/firebaseAuthRuntime'

// "Request notes": a class whose notes are not written yet can be asked for, one ask per reader,
// counted with the asks from the Telegram app on CyberJudah's server (/api/app/requests). A reader
// who asks to be told hears in the app: the server keeps the notes that came out for them until
// the app next asks (takeReadyNotes).

const ORIGIN = (
  process.env.EXPO_PUBLIC_CYBERJUDAH_API_URL ||
  'https://cyberjudah-telegram-staging.oisrae1.workers.dev'
).replace(/\/+$/, '')

const VIDEO = /^[\w-]{11}$/

export type NoteRequestState = { signedIn: boolean; count: number; mine: boolean; tell: boolean }
export type ReadyNote = { video: string; title: string; teacher?: string }

type User = { getIdToken: () => Promise<string> } | null

const call = async (
  path: string,
  init: { method?: 'GET' | 'POST' | 'DELETE'; body?: unknown },
  fetcher: typeof fetch,
  user: User
): Promise<Response | null> => {
  if (!user) return null
  const token = await user.getIdToken()
  const response = await fetcher(`${ORIGIN}/api/app/requests${path}`, {
    method: init.method ?? 'GET',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${token}`,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  })
  if (response.status === 401) return null
  if (!response.ok) throw new Error(`CYBERJUDAH_NOTE_REQUEST_UNAVAILABLE:${response.status}`)
  return response
}

const stateOf = async (response: Response | null): Promise<NoteRequestState> => {
  if (!response) return { signedIn: false, count: 0, mine: false, tell: false }
  const body = (await response.json()) as { count?: number; mine?: boolean; tell?: boolean }
  return {
    signedIn: true,
    count: Math.max(0, Math.floor(Number(body.count) || 0)),
    mine: body.mine === true,
    tell: body.tell === true,
  }
}

/** How many have asked for a class's notes, and whether this reader has. */
export const getNoteRequest = async (
  video: string,
  fetcher: typeof fetch = fetch,
  user: User = getCurrentAuthUser()
): Promise<NoteRequestState> => {
  if (!VIDEO.test(video)) throw new Error('CYBERJUDAH_NOTE_REQUEST_BAD_VIDEO')
  return stateOf(await call(`/${video}`, {}, fetcher, user))
}

/** Ask for a class's notes; with `tell`, be told in the app when they are published. */
export const requestNotes = async (
  video: string,
  title: string,
  tell: boolean,
  fetcher: typeof fetch = fetch,
  user: User = getCurrentAuthUser()
): Promise<NoteRequestState> => {
  if (!VIDEO.test(video)) throw new Error('CYBERJUDAH_NOTE_REQUEST_BAD_VIDEO')
  return stateOf(
    await call(
      `/${video}`,
      { method: 'POST', body: { title: title.slice(0, 200), tell } },
      fetcher,
      user
    )
  )
}

/** The requested notes that came out since the app last asked. The server hands each over once. */
export const takeReadyNotes = async (
  fetcher: typeof fetch = fetch,
  user: User = getCurrentAuthUser()
): Promise<ReadyNote[]> => {
  const response = await call('/ready', {}, fetcher, user)
  if (!response) return []
  const body = (await response.json()) as { ready?: ReadyNote[] }
  return (body.ready ?? []).filter(
    note =>
      typeof note?.video === 'string' && VIDEO.test(note.video) && typeof note.title === 'string'
  )
}
