jest.mock('../BasicFooter', () => 'BasicFooter')
import React from 'react'
import { act, create } from 'react-test-renderer'
import { atom } from 'jotai/vanilla'

import type { BibleTab } from '~state/tabs'
import BibleFooter from '../BibleFooter'
import { useKjvRecordingsCatalog } from '~helpers/useKjvRecordingsCatalog'

jest.mock('~helpers/useKjvRecordingsCatalog', () => ({ useKjvRecordingsCatalog: jest.fn() }))

jest.mock('~helpers/bibleVersions', () => ({
  getVersions: () => ({
    LSG: { hasAudio: false },
    KJV: {
      getAudioUrl: jest.requireActual('../../../../helpers/recordingsCatalog').getRecordingAudioUrl,
    },
  }),
  getBibleVersionCanonId: () => 'protestant-66',
}))
jest.mock('~helpers/bibleCoverage', () => ({
  resolveBibleCoverageCanonId: () => 'protestant-66',
  getNextAvailableChapterLocation: () => ({ book: 49, chapter: 3 }),
  getPreviousAvailableChapterLocation: () => ({ book: 49, chapter: 1 }),
}))

jest.mock('~state/tabs', () => ({
  useIsCurrentTab: () => () => false,
}))

jest.mock('../atom', () => {
  const { atom: createAtom } = jest.requireActual<typeof import('jotai/vanilla')>('jotai/vanilla')
  return { playingBibleTabIdAtom: createAtom(undefined) }
})

jest.mock('../AudioUrlFooter', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return (props: Record<string, unknown>) => ReactModule.createElement('AudioUrlFooter', props)
})
jest.mock('../BackToAudioFooter', () => () => null)

describe('BibleFooter', () => {
  beforeAll(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  })

  it('renders on a standalone full-chapter screen outside the primary Bible tab', () => {
    const bibleAtom = atom({ id: 'standalone-bible', data: {} } as BibleTab)
    const chapterVerses = [
      { Livre: 49, Chapitre: 2, Verset: 1, Texte: 'Vous étiez morts.' },
    ] as never
    let renderer: ReturnType<typeof create>

    act(() => {
      renderer = create(
        <BibleFooter
          bibleAtom={bibleAtom}
          book={{ Numero: 49, Nom: 'Éphésiens', Chapitres: 6 }}
          chapter={2}
          chapterVerses={chapterVerses}
          goToPrevChapter={jest.fn()}
          goToNextChapter={jest.fn()}
          goToChapter={jest.fn()}
          version="LSG"
          isInTab={false}
        />
      )
    })

    expect(renderer!.root.find(node => String(node.type) === 'BasicFooter').props.hasError).toBe(
      true
    )
    const footer = renderer!.root.find(node => String(node.type) === 'BasicFooter')
    expect(footer.props.isDisabled).not.toBe(true)
    expect(footer.props.isAudioDisabled).toBe(true)
    expect(footer.props.onPrevChapter).toEqual(expect.any(Function))
    expect(footer.props.onNextChapter).toEqual(expect.any(Function))
    expect(renderer!.root.findAll(node => String(node.type) === 'AudioUrlFooter')).toHaveLength(0)
  })

  it('changes Genesis 1 from unavailable to the player when the catalog arrives; Leviticus 1 stays unavailable', () => {
    const bibleAtom = atom({ id: 'kjv-bible', data: {} } as BibleTab)
    const footer = (book: number) => (
      <BibleFooter
        bibleAtom={bibleAtom}
        book={{ Numero: book, Nom: 'Genesis', Chapitres: 50 }}
        chapter={1}
        goToPrevChapter={jest.fn()}
        goToNextChapter={jest.fn()}
        goToChapter={jest.fn()}
        version="KJV"
        isInTab={false}
      />
    )
    let renderer: ReturnType<typeof create>
    act(() => {
      renderer = create(footer(1))
    })
    expect(
      renderer!.root.find(node => String(node.type) === 'BasicFooter').props.isAudioDisabled
    ).toBe(true)
    const catalog = {
      chapters: [
        {
          slug: 'genesis',
          chapter: 1,
          audio: 'recordings/michael-armenta/genesis/1.m4a',
          sha256: 'a'.repeat(64),
        },
      ],
    }
    jest.mocked(useKjvRecordingsCatalog).mockReturnValue(catalog)
    act(() => {
      renderer!.update(footer(1))
    })
    expect(renderer!.root.findAll(node => String(node.type) === 'BasicFooter')).toHaveLength(0)
    expect(
      renderer!.root.find(node => String(node.type) === 'AudioUrlFooter').props.recordingsCatalog
    ).toEqual(catalog)
    act(() => {
      renderer!.update(footer(3))
    })
    expect(renderer!.root.find(node => String(node.type) === 'BasicFooter').props.hasError).toBe(
      true
    )
    act(() => {
      renderer!.unmount()
    })
    jest.mocked(useKjvRecordingsCatalog).mockReset()
  })
})
