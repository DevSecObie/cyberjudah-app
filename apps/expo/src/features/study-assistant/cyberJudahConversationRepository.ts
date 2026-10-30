import {
  deleteAssistantConversation,
  observeAssistantConversationIndex,
  observeAssistantConversation,
  saveAssistantConversationTurn,
  renameAssistantConversation,
} from '~helpers/cyberJudahConversationFirestore'
import {
  parseChatTurn,
  type Chat,
  type ChatSummary,
  type ChatTurn,
} from './cyberJudahConversations'

export const observeChats = (
  account: string,
  changed: (chats: ChatSummary[]) => void,
  failed: (error: unknown) => void
) =>
  observeAssistantConversationIndex(
    account,
    50,
    rows => {
      try {
        changed(
          rows.map(row => {
            const value = row.data as Record<string, unknown>
            if (
              typeof value.title !== 'string' ||
              typeof value.updatedAt !== 'number' ||
              typeof value.messageCount !== 'number'
            )
              throw new Error('CLOUD_HISTORY_INVALID')
            return {
              id: row.id,
              title: value.title,
              updatedAt: value.updatedAt,
              count: value.messageCount / 2,
            }
          })
        )
      } catch (error) {
        failed(error)
      }
    },
    failed
  )

export function observeChat(
  account: string,
  id: string,
  changed: (chat: Chat | null) => void,
  failed: (error: unknown) => void
) {
  let metadata: Record<string, unknown> | null = null
  let turns: ChatTurn[] | null = null
  const emit = () => {
    if (!metadata || !turns || turns.length * 2 !== metadata.messageCount) return
    if (typeof metadata.title !== 'string' || typeof metadata.updatedAt !== 'number')
      return failed(new Error('CLOUD_HISTORY_INVALID'))
    changed({ id, title: metadata.title, updatedAt: metadata.updatedAt, turns })
  }
  return observeAssistantConversation(
    account,
    id,
    row => {
      metadata = row ? (row.data as Record<string, unknown>) : null
      if (!row) changed(null)
      else emit()
    },
    rows => {
      try {
        turns = rows.map(parseChatTurn)
        emit()
      } catch (error) {
        failed(error)
      }
    },
    failed
  )
}

export async function saveChatTurn(account: string, chat: Chat, turn: ChatTurn) {
  parseChatTurn(turn)
  await saveAssistantConversationTurn(
    account,
    chat.id,
    {
      schemaVersion: 1,
      title: chat.title || turn.question.replace(/\s+/g, ' ').slice(0, 100),
      createdAt: chat.turns[0]?.createdAt ?? turn.createdAt,
      updatedAt: Date.now(),
      messageCount: chat.turns.length * 2,
    },
    turn.id,
    turn
  )
}

export const deleteChat = deleteAssistantConversation
export const renameChat = renameAssistantConversation
