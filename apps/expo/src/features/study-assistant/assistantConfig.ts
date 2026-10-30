import { hasAssistantBetaAccess, parseAssistantBetaUids } from './assistantAccess'
import { isCyberJudahAssistant } from './cyberJudahAsk'

const assistantBetaUids = parseAssistantBetaUids(process.env.EXPO_PUBLIC_AI_BETA_UIDS)

// A CyberJudah build asks its own server (cyberJudahAsk.ts), open to every signed-in account.
export const assistantAvailable =
  isCyberJudahAssistant || Boolean(process.env.EXPO_PUBLIC_AI_API_URL)

export const assistantAccessible = (uid?: string | null) =>
  isCyberJudahAssistant
    ? Boolean(uid)
    : assistantAvailable && hasAssistantBetaAccess(uid, assistantBetaUids)
