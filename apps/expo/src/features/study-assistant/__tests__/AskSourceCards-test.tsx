jest.mock('expo-modules-core', () => ({
  uuid: { v4: () => '9b3dc198-81d0-46a4-a019-e5985901661b' },
}))
import React from 'react'
jest.mock('~features/lexique/cyberJudahPortraits', () => ({ CYBERJUDAH_PORTRAITS: {} }))
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import AskSourceCards from '../AskSourceCards'

const mockOpen = jest.fn().mockResolvedValue(undefined)
jest.mock('../useOpenStudySource', () => ({
  useOpenStudySource: () => mockOpen,
}))
function mockHost(name: string) {
  return ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement(name, props, children)
}
jest.mock('react-native', () => ({
  Linking: { openURL: (...args: unknown[]) => mockOpen(...args) },
  Pressable: mockHost('Pressable'),
  ScrollView: mockHost('ScrollView'),
}))
jest.mock('expo-image', () => ({ Image: mockHost('Image') }))
jest.mock('~common/ui/Box', () => ({
  __esModule: true,
  default: mockHost('Box'),
  HStack: mockHost('HStack'),
}))
jest.mock('~common/ui/Text', () => ({ __esModule: true, default: mockHost('Text') }))
jest.mock('~common/ui/Icon', () => ({ FeatherIcon: mockHost('Icon') }))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }))
jest.mock('~helpers/firebaseAuthRuntime', () => ({ getCurrentAuthUser: jest.fn() }))

let view: ReactTestRenderer
beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})
afterEach(() => {
  if (view) act(() => view.unmount())
})

it('keeps text-only sources compact without a blank artwork block', () => {
  act(() => {
    view = create(
      <AskSourceCards
        sources={[{ n: 1, kind: 'study', title: 'Faith and works', url: '/studies/faith' }]}
      />
    )
  })
  expect(view.root.findAllByType('Image' as never)).toHaveLength(0)
  expect(
    view.root.findAllByProps({
      className: 'aspect-video w-full items-center justify-center bg-light-grey',
    })
  ).toHaveLength(0)
  act(() => view.root.findByType('Pressable' as never).props.onPress())
  expect(mockOpen).toHaveBeenCalledWith({
    n: 1,
    kind: 'study',
    title: 'Faith and works',
    url: '/studies/faith',
  })
})

it('keeps a video thumbnail and timestamp link, then collapses failed artwork gracefully', () => {
  act(() => {
    view = create(
      <AskSourceCards
        sources={[
          {
            n: 1,
            kind: 'class',
            title: 'Faith and works',
            url: '/classes/faith',
            video: 'abcdefghijk',
            t: 90,
          },
        ]}
      />
    )
  })
  expect(view.root.findByType('Image' as never).props.source.uri).toContain('abcdefghijk')
  act(() => view.root.findByType('Pressable' as never).props.onPress())
  expect(mockOpen).toHaveBeenLastCalledWith(
    expect.objectContaining({ video: 'abcdefghijk', t: 90 })
  )
  let failures = 0
  while (view.root.findAllByType('Image' as never).length && failures < 6) {
    act(() => view.root.findByType('Image' as never).props.onError())
    failures++
  }
  expect(view.root.findAllByType('Image' as never)).toHaveLength(0)
  expect(
    view.root.findAllByProps({
      className: 'aspect-video w-full items-center justify-center bg-light-grey',
    })
  ).toHaveLength(0)
  expect(JSON.stringify(view.toJSON())).toContain('Faith and works')
})
