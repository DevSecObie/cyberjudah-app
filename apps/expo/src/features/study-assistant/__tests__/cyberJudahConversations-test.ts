import {
  chatHistory,
  consentKey,
  linkedAnswer,
  parseChatTurn,
  type ChatTurn,
} from '../cyberJudahConversations'
const turn = (state: ChatTurn['state'], question = 'Who is Judah?'): ChatTurn => ({
  id: 'turn1',
  question,
  answer: 'Judah [1].',
  state,
  createdAt: 1,
  sources: [],
})
it('never forwards stopped or failed answers as completed conversation context', () => {
  expect(chatHistory([turn('error'), turn('interrupted'), turn('complete')])).toEqual([
    { role: 'user', content: 'Who is Judah?' },
    { role: 'assistant', content: 'Judah [1].' },
  ])
})
it('keeps the request below the transport limit while retaining complete pairs', () => {
  const history = chatHistory(
    Array.from({ length: 20 }, () => ({ ...turn('complete'), answer: 'a'.repeat(5000) }))
  )
  expect(history.length % 2).toBe(0)
  expect(history.reduce((n, m) => n + m.content.length, 0)).toBeLessThanOrEqual(20000)
})
it('scopes provider permission to the signed-in account', () => {
  expect(consentKey('alice')).not.toEqual(consentKey('bob'))
  expect(consentKey('a:b')).not.toEqual(consentKey('a%3Ab'))
})
it('makes only known numbered citations tappable without changing existing links', () => {
  const source = { n: 1, kind: 'class', title: 'Lesson', url: '/class' }
  expect(
    linkedAnswer(
      'Check [1], [2], [1](https://existing.test).',
      [source],
      () => 'https://cyberjudah.io/class'
    )
  ).toBe('Check [1](https://cyberjudah.io/class), [2], [1](https://existing.test).')
})
it('refuses corrupted or unbounded saved chat turns', () => {
  expect(() => parseChatTurn({ ...turn('complete'), answer: 'a'.repeat(60001) })).toThrow(
    'CLOUD_HISTORY_INVALID'
  )
  expect(() => parseChatTurn({ ...turn('complete'), sources: [null] })).toThrow(
    'CLOUD_HISTORY_INVALID'
  )
  expect(parseChatTurn(turn('complete')).state).toBe('complete')
})
