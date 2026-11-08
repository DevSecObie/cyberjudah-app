import { getBibleVersionCanonId, getVersions } from '~helpers/bibleVersions'
import {
  resolveBibleCoverageCanonId,
  getNextAvailableChapterLocation,
  getPreviousAvailableChapterLocation,
} from '~helpers/bibleCoverage'
import { canGoToNextPlanChapter, canGoToPreviousPlanChapter } from '../planPassage'
import BasicFooter from './BasicFooter'
import React from 'react'
import { useKjvRecordingsCatalog } from '~helpers/useKjvRecordingsCatalog'

import { useAtomValue } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import type { Verse } from '~common/types'
import { Book } from '~assets/bible_versions/books-desc'
import type { BibleVersionCoverage } from '~helpers/biblesDb'
import { BibleTab, useIsCurrentTab, VersionCode } from '~state/tabs'
import { playingBibleTabIdAtom } from './atom'
import AudioUrlFooter from './AudioUrlFooter'
import BackToAudioFooter from './BackToAudioFooter'

type BibleFooterProps = {
  book: Book
  chapter: number
  goToNextChapter: () => void
  goToPrevChapter: () => void
  goToChapter: (x: { book: Book; chapter: number }) => void
  disabled?: boolean
  version: VersionCode
  bibleAtom: PrimitiveAtom<BibleTab>
  chapterVerses?: Verse[]
  coverage?: BibleVersionCoverage
  isInTab?: boolean
}

const BibleFooter = ({
  bibleAtom,
  chapterVerses,
  book,
  chapter,
  goToNextChapter,
  goToPrevChapter,
  goToChapter,
  disabled,
  version,
  coverage,
  isInTab = true,
}: BibleFooterProps) => {
  const bibleTab = useAtomValue(bibleAtom)
  const playingBibleTabId = useAtomValue(playingBibleTabIdAtom)
  // Use stable tab.id instead of atom.toString()
  const isTabPlaying = playingBibleTabId === bibleTab.id
  const getIsCurrentTab = useIsCurrentTab()
  const isCurrentTab = getIsCurrentTab(bibleAtom)
  const recordingsCatalog = useKjvRecordingsCatalog(
    version === 'KJV' && (!isInTab || isCurrentTab || isTabPlaying)
  )

  if (isInTab && !isCurrentTab && !isTabPlaying) {
    return null
  }

  if (playingBibleTabId && !isTabPlaying) {
    return (
      <BackToAudioFooter
        isParallel={Boolean(bibleTab.data.parallelVersions?.length)}
        book={book}
        chapter={chapter}
        goToNextChapter={goToNextChapter}
        goToPrevChapter={goToPrevChapter}
        disabled={disabled}
        coverage={coverage}
        planPassage={bibleTab.data.planPassage}
        version={version}
      />
    )
  }

  if (!getVersions()[version]?.getAudioUrl?.(book.Numero, chapter, recordingsCatalog)) {
    const canonId = resolveBibleCoverageCanonId(coverage, getBibleVersionCanonId(version))
    const location = { book: book.Numero, chapter }
    const hasPreviousChapter =
      canGoToPreviousPlanChapter(bibleTab.data.planPassage, location) &&
      !!getPreviousAvailableChapterLocation(book, chapter, coverage, canonId)
    const hasNextChapter =
      canGoToNextPlanChapter(bibleTab.data.planPassage, location) &&
      !!getNextAvailableChapterLocation(book, chapter, coverage, canonId)
    return (
      <BasicFooter
        isParallel={Boolean(bibleTab.data.parallelVersions?.length)}
        onPlay={() => undefined}
        isPlaying={false}
        isDisabled={disabled}
        isAudioDisabled
        hasError
        onPrevChapter={hasPreviousChapter ? goToPrevChapter : undefined}
        onNextChapter={hasNextChapter ? goToNextChapter : undefined}
      />
    )
  }

  return (
    <AudioUrlFooter
      isParallel={Boolean(bibleTab.data.parallelVersions?.length)}
      book={book}
      chapter={chapter}
      goToNextChapter={goToNextChapter}
      goToPrevChapter={goToPrevChapter}
      goToChapter={goToChapter}
      disabled={disabled}
      version={version}
      coverage={coverage}
      planPassage={bibleTab.data.planPassage}
      bibleAtom={bibleAtom}
      recordingsCatalog={recordingsCatalog}
    />
  )
}

export default BibleFooter
