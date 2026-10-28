import React, { act } from 'react'
import { create, type ReactTestRenderer } from 'react-test-renderer'
import type { AccountConnections } from '~helpers/accountConnections'
import ConnectedAccounts from '../ConnectedAccounts'

let mockUid = 'first'
const mockLoad = jest.fn<Promise<AccountConnections | null>, unknown[]>()
const mockConnect = jest.fn()
jest.mock('react-native', () => ({ AppState: { addEventListener: () => ({ remove: jest.fn() }) } }))
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => () => void) => {
    const React = require('react')
    React.useEffect(callback, [callback])
  },
}))
jest.mock('~helpers/useLogin', () => ({
  __esModule: true,
  default: () => ({ user: { id: mockUid } }),
}))
jest.mock('~helpers/cyberJudahAccount', () => ({ connectTelegramAccount: () => mockConnect() }))
jest.mock('~helpers/accountConnections', () => ({
  connectedProviders: () => [],
  loadAccountConnections: (...args: unknown[]) => mockLoad(...args),
  subscribeAccountConnections: () => () => undefined,
}))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('~common/ui/Icon', () => ({ FeatherIcon: 'FeatherIcon', IonIcon: 'IonIcon' }))
jest.mock('~common/ui/ListSection', () => ({
  __esModule: true,
  default: 'ListSection',
  ListRow: 'ListRow',
}))

describe('Connected account rows', () => {
  let renderer: ReactTestRenderer
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    mockUid = 'first'
    mockLoad.mockReset()
    mockConnect.mockReset()
  })
  afterEach(() => act(() => renderer?.unmount()))
  const rows = () =>
    renderer.root.findAll(item => String(item.type) === 'ListRow').map(item => item.props)
  const render = async () => {
    await act(async () => {
      renderer = create(<ConnectedAccounts />)
    })
  }

  it('shows the verified provider emails and Telegram name without offering another link', async () => {
    mockLoad.mockResolvedValue({
      uid: 'first',
      providers: [
        { id: 'apple.com', email: 'apple@example.test' },
        { id: 'google.com', email: 'google@example.test' },
      ],
      telegram: { status: 'connected', label: '@reader' },
    })
    await render()
    expect(rows().map(row => [row.label, row.description])).toEqual([
      ['Apple', 'apple@example.test'],
      ['Google', 'google@example.test'],
      ['Telegram', '@reader'],
    ])
    expect(rows()[2].onPress).toBeUndefined()
    expect(rows()[2].accessibilityLabel).toContain('profile.connectedAccounts.connected')
  })

  it('discards a previous account response after the displayed account changes', async () => {
    let finish!: (result: AccountConnections) => void
    mockLoad.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve
        })
    )
    await render()
    mockUid = 'second'
    mockLoad.mockResolvedValue({
      uid: 'second',
      providers: [{ id: 'google.com', email: 'new@example.test' }],
      telegram: { status: 'not-connected' },
    })
    await act(async () => {
      renderer.update(<ConnectedAccounts />)
    })
    await act(async () => {
      finish({
        uid: 'first',
        providers: [{ id: 'apple.com', email: 'old@example.test' }],
        telegram: { status: 'connected', label: '@old' },
      })
    })
    expect(rows().map(row => row.description)).toEqual([
      'new@example.test',
      'profile.connectedAccounts.notConnected',
    ])
    expect(mockLoad.mock.calls[0][1]).toEqual(expect.objectContaining({ aborted: true }))
  })

  it('retries a failed check without starting a new account link', async () => {
    mockLoad.mockResolvedValueOnce({
      uid: 'first',
      providers: [],
      telegram: { status: 'unavailable' },
    })
    await render()
    expect(rows()[0].description).toBe('profile.connectedAccounts.unavailable')
    mockLoad.mockResolvedValueOnce({
      uid: 'first',
      providers: [],
      telegram: { status: 'connected' },
    })
    await act(async () => {
      rows()[0].onPress()
    })
    expect(mockConnect).not.toHaveBeenCalled()
    expect(rows()[0].description).toBe('profile.connectedAccounts.connected')
  })
})
