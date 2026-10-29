import React, { act } from 'react'
import { create, type ReactTestRenderer } from 'react-test-renderer'
import type { ConnectedProvider } from '~helpers/accountConnections'
import ConnectedAccounts from '../ConnectedAccounts'

let mockUid = 'first'
let mockProviders: ConnectedProvider[] = []
let mockRefresh: (() => void) | undefined
let mockForeground: ((state: string) => void) | undefined
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: (_event: string, callback: (state: string) => void) => {
      mockForeground = callback
      return { remove: jest.fn() }
    },
  },
}))
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => () => void) => {
    const React = jest.requireActual<typeof import('react')>('react')
    React.useEffect(callback, [callback])
  },
}))
jest.mock('~helpers/useLogin', () => ({
  __esModule: true,
  default: () => ({ user: { id: mockUid } }),
}))
jest.mock('~helpers/accountConnections', () => ({
  connectedProviders: () => mockProviders,
  subscribeAccountConnections: (callback: () => void) => {
    mockRefresh = callback
    return () => {
      mockRefresh = undefined
    }
  },
}))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('~common/ui/Icon', () => ({ FeatherIcon: 'FeatherIcon', IonIcon: 'IonIcon' }))
jest.mock('~common/ui/SectionCard', () => ({
  __esModule: true,
  default: 'SectionCard',
  SectionCardHeader: 'SectionCardHeader',
}))

jest.mock('~common/ui/CardLinkItem', () => ({ __esModule: true, default: 'CardLinkItem' }))
jest.mock('~common/ui/Box', () => ({ __esModule: true, default: 'Box' }))
jest.mock('~common/ui/Text', () => ({ __esModule: true, default: 'Text' }))

describe('Standalone connected account rows', () => {
  let renderer: ReactTestRenderer
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    mockUid = 'first'
    mockProviders = []
    mockRefresh = undefined
    mockForeground = undefined
  })
  afterEach(() => act(() => renderer?.unmount()))
  const rows = () =>
    renderer.root
      .findAll(item => String(item.type) === 'CardLinkItem')
      .map(item => ({
        onPress: item.props.onPress,
        route: item.props.route,
        label: item.findAll(child => String(child.type) === 'Text')[0]?.props.children,
        description: item.findAll(child => String(child.type) === 'Text')[1]?.props.children,
      }))
  const render = async () => {
    await act(async () => {
      renderer = create(<ConnectedAccounts />)
    })
  }

  it('shows verified Apple, Google and email providers using existing list rows, with no Telegram action', async () => {
    mockProviders = [
      { id: 'apple.com', email: 'apple@example.test' },
      { id: 'google.com', email: 'google@example.test' },
      { id: 'password', email: 'email@example.test' },
    ]
    await render()
    expect(rows().map(row => [row.label, row.description])).toEqual([
      ['Apple', 'apple@example.test'],
      ['Google', 'google@example.test'],
      ['profile.connectedAccounts.email', 'email@example.test'],
    ])
    expect(rows().every(row => !row.onPress && !row.route)).toBe(true)
  })

  it('replaces the old provider display when the active account changes', async () => {
    mockProviders = [{ id: 'apple.com', email: 'old@example.test' }]
    await render()
    mockUid = 'second'
    mockProviders = [{ id: 'google.com', email: 'new@example.test' }]
    await act(async () => {
      renderer.update(<ConnectedAccounts />)
    })
    expect(rows().map(row => row.description)).toEqual(['new@example.test'])
  })

  it('refreshes providers after authentication changes and returning to the app', async () => {
    await render()
    expect(rows()).toHaveLength(0)
    mockProviders = [{ id: 'apple.com', email: 'reader@example.test' }]
    await act(async () => {
      mockRefresh?.()
    })
    expect(rows().map(row => row.label)).toEqual(['Apple'])
    mockProviders = [{ id: 'password', email: 'reader@example.test' }]
    await act(async () => {
      mockForeground?.('active')
    })
    expect(rows().map(row => row.label)).toEqual(['profile.connectedAccounts.email'])
  })
})
