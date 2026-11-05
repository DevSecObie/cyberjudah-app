import React from 'react'
import { act, create } from 'react-test-renderer'
import AlphabetList from '../AlphabetList'

jest.mock('react-native', () => ({ TouchableOpacity: 'TouchableOpacity' }))
jest.mock('react-native-reanimated', () => ({ Easing: { bezier: () => undefined } }))
jest.mock('react-native-reanimated-carousel', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    Carousel: ({
      data,
      renderItem,
    }: {
      data: string[]
      renderItem: (item: { item: string; index: number }) => React.ReactNode
    }) =>
      data.map((item, index) =>
        ReactModule.createElement(ReactModule.Fragment, { key: item }, renderItem({ item, index }))
      ),
  }
})
jest.mock('~common/ui/Box', () => 'Box')
jest.mock('~common/ui/Text', () => 'Text')
jest.mock('~common/ui/Border', () => () => null)
jest.mock('~common/ui/PageContent', () => 'PageContent')
jest.mock('~themes/ThemeProvider', () => ({ useTheme: () => ({ colors: { primary: 'blue' } }) }))

it('announces the selected letter for lowercase initial state and lets readers select another letter', () => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  const select = jest.fn()
  let renderer: ReturnType<typeof create>
  act(() => {
    renderer = create(<AlphabetList letter="a" setLetter={select} />)
  })
  const choices = renderer!.root.findAllByProps({ accessibilityRole: 'radio' })
  expect(
    choices
      .filter(choice => choice.props.accessibilityState.checked)
      .map(choice => choice.props.accessibilityLabel)
  ).toEqual(['A'])
  act(() => choices.find(choice => choice.props.accessibilityLabel === 'B')!.props.onPress())
  expect(select).toHaveBeenCalledWith('B')
  act(() => renderer!.unmount())
})
