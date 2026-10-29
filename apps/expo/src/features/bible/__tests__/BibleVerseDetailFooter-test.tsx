/* eslint-disable import/first */

import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('~common/ui/classNameIcons', () => ({ Feather: 'Feather' }))
jest.mock('react-native', () => ({ TouchableOpacity: 'TouchableOpacity' }))
jest.mock('~common/ui/Box', () => ({ __esModule: true, default: 'Box' }))
jest.mock('~common/ui/Text', () => ({ __esModule: true, default: 'Text' }))

import BibleVerseDetailFooter from '../BibleVerseDetailFooter'

const labels = (renderer: ReactTestRenderer) => JSON.stringify(renderer.toJSON())

describe('BibleVerseDetailFooter', () => {
  const render = (verseNumber: number, last: number, first?: number) => {
    let renderer!: ReactTestRenderer
    act(() => {
      renderer = create(
        <BibleVerseDetailFooter
          verseNumber={verseNumber}
          goToNextVerse={jest.fn()}
          goToPrevVerse={jest.fn()}
          versesInCurrentChapter={last}
          firstVerseInCurrentChapter={first}
        />
      )
    })
    return renderer
  }

  it('stops at the first and last verse of a chapter that starts at verse 4', () => {
    const atFirst = render(4, 13, 4)
    expect(labels(atFirst)).not.toContain('Verset précédent')
    expect(labels(atFirst)).toContain('Verset suivant')
    const atTen = render(10, 13, 4)
    expect(labels(atTen)).toContain('Verset précédent')
    expect(labels(atTen)).toContain('Verset suivant')
    const atLast = render(13, 13, 4)
    expect(labels(atLast)).not.toContain('Verset suivant')
  })

  it('keeps chapters that start at verse 1 unchanged', () => {
    expect(labels(render(1, 36))).not.toContain('Verset précédent')
    expect(labels(render(2, 36))).toContain('Verset précédent')
  })
})
