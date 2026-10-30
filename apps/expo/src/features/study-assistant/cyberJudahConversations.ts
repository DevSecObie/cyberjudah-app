import type { CyberJudahSource } from './cyberJudahAsk'

export type ChatTurn = {
  traceId?: string
  id: string
  question: string
  answer: string
  sources: CyberJudahSource[]
  createdAt: number
  state: 'complete' | 'interrupted' | 'error'
  model?: string
  followups?: string[]
  steps?: string[]
  ui?: string
  teachingFound?: boolean
}
export type Chat = { id: string; title: string; updatedAt: number; turns: ChatTurn[] }
export type ChatSummary = Omit<Chat, 'turns'> & { count: number }

export function newChat(): Chat {
  return {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`,
    title: '',
    updatedAt: Date.now(),
    turns: [],
  }
}

export function parseChatTurn(value: unknown): ChatTurn {
  const v = value as ChatTurn | null
  if (
    !v ||
    typeof v.id !== 'string' ||
    v.id.length > 100 ||
    (v.traceId !== undefined &&
      (typeof v.traceId !== 'string' || !/^[a-f0-9-]{36}$/i.test(v.traceId))) ||
    typeof v.question !== 'string' ||
    v.question.length > 4000 ||
    (v.ui !== undefined && (typeof v.ui !== 'string' || v.ui.length > 60000)) ||
    typeof v.answer !== 'string' ||
    v.answer.length > 60000 ||
    !Number.isFinite(v.createdAt) ||
    !['complete', 'interrupted', 'error'].includes(v.state) ||
    !Array.isArray(v.sources) ||
    v.sources.length > 12 ||
    v.sources.some(
      s => !s || !Number.isInteger(s.n) || typeof s.title !== 'string' || typeof s.url !== 'string'
    )
  ) {
    throw new Error('CLOUD_HISTORY_INVALID')
  }
  return v
}

/** Only finished exchanges are offered as context; a stopped/error answer is never presented as fact. */
export function chatHistory(turns: ChatTurn[]) {
  const history = turns
    .filter(turn => turn.state === 'complete')
    .slice(-4)
    .flatMap(turn => [
      { role: 'user' as const, content: turn.question },
      { role: 'assistant' as const, content: turn.answer },
    ])
  while (history.reduce((n, m) => n + m.content.length, 0) > 20000) history.splice(0, 2)
  return history
}

export const consentKey = (uid: string) => `cyberjudah.ask.consent.v2:${encodeURIComponent(uid)}`

/** Telegram's numbered citations become links to the actual cited class or note. */
export function linkedAnswer(
  answer: string,
  sources: CyberJudahSource[],
  link: (source: CyberJudahSource) => string | undefined
) {
  return answer.replace(/\[(\d{1,2})\](?!\()/g, (label, n: string) => {
    const source = sources.find(s => s.n === Number(n))
    const url = source && link(source)
    return url ? `[${n}](${url.replace(/\(/g, '%28').replace(/\)/g, '%29')})` : label
  })
}
