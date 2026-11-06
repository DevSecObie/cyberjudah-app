// Publishing a study on CyberJudah's own server (cyberjudah-telegram bot/src/published-studies.ts).
// The reader's Firebase sign-in proves who is publishing; the study goes as Markdown and anyone
// with the link reads it at <server>/app/published/<id>. Nothing is sent to Bible Strong.
import { getCurrentAuthUser } from '~helpers/firebaseAuthRuntime'
import type { Study } from '~redux/modules/user'
import { studyMarkdown } from './studyMarkdown'

export const cyberJudahServer = () =>
  (
    process.env.EXPO_PUBLIC_CYBERJUDAH_API_URL ||
    'https://cyberjudah-telegram-staging.oisrae1.workers.dev'
  ).replace(/\/+$/, '')

export const publishedStudyUrl = (id: string) =>
  `${cyberJudahServer()}/app/published/${encodeURIComponent(id)}`

const api = (id?: string) =>
  `${cyberJudahServer()}/api/published-studies${id ? `/${encodeURIComponent(id)}` : ''}`

export class PublishError extends Error {
  constructor(
    readonly reason: string,
    readonly status: number
  ) {
    super(reason)
  }
}

const signedIn = async () => {
  const user = getCurrentAuthUser()
  if (!user) throw new PublishError('sign_in_required', 401)
  return { authorization: `Bearer ${await user.getIdToken()}` }
}

const send = async (url: string, init: RequestInit) => {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new PublishError(body?.error || 'publish_failed', response.status)
  }
  return response
}

/** Puts the study (or its new words) online. */
export async function putPublishedStudy(study: Study) {
  const body = studyMarkdown(study.content)
  await send(api(study.id), {
    method: 'PUT',
    headers: { ...(await signedIn()), 'content-type': 'application/json' },
    body: JSON.stringify({ title: study.title, author: study.user?.displayName ?? '', body }),
  })
}

/** Takes the study down. */
export async function deletePublishedStudy(id: string) {
  await send(api(id), { method: 'DELETE', headers: await signedIn() })
}

// Both Workers use the same Firebase project, but separate publication stores.
// Each existing endpoint derives its own owner hash from the verified UID.
const accountPublicationServers = [
  'https://cyberjudah.io',
  'https://cyberjudah-telegram-staging.oisrae1.workers.dev',
] as const

/** Remove native publications and account links in both stores, preserving Telegram data. */
export async function deleteNativeWorkerAccountData(expectedUid: string) {
  if (!accountPublicationServers.some(server => server === cyberJudahServer()))
    throw new PublishError('account_cleanup_environment_unknown', 503)
  const user = getCurrentAuthUser()
  if (!user || user.uid !== expectedUid) throw new PublishError('account_changed', 401)
  const headers = { authorization: `Bearer ${await user.getIdToken()}` }
  for (const path of ['/api/published-studies', '/api/firebase/link']) {
    for (const server of accountPublicationServers) {
      if (getCurrentAuthUser()?.uid !== expectedUid) throw new PublishError('account_changed', 401)
      await send(`${server}${path}`, { method: 'DELETE', headers })
    }
  }
  if (getCurrentAuthUser()?.uid !== expectedUid) throw new PublishError('account_changed', 401)
}

/** 200 when it is online, 404 when it is not. */
export async function publishedStudyStatus(id: string) {
  const response = await fetch(api(id), { signal: AbortSignal.timeout(10_000) })
  return response.status
}
