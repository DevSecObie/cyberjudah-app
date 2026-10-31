import { useSelector } from 'react-redux'
import { selectFontFamily } from '~redux/selectors/user'
import { resolveFontFamily } from '~themes/styleValues'
import { twMerge } from '~common/ui/classNames'

import React from 'react'

import Box from '~common/ui/Box'
import { Plan, TextSlice as TextSliceProps } from '~common/types'
import { FeatherIcon } from '~common/ui/Icon'
import Loading from '~common/Loading'
import { ClassNotesBlocks } from '~features/passageMediaLibrary/ClassNotesList'
import { usePublishedNote } from '~features/publishedNotes/PublishedNoteScreen'
import { useOpenSiteLink } from '~features/publishedNotes/siteLinks'
import books from '~assets/cyberjudah/books.json'
import ReferenceParagraph from './ReferenceParagraph'
import ChapterSlice from './ChapterSlice'

type Props = TextSliceProps & {
  planLanguage?: Plan['lang']
}

/** "/study/esther/11" → "71|11": the chapter a study note is written on, in the plan's form. */
export const noteChapter = (notePath: string) => {
  const match = /^\/study\/([a-z0-9-]+)\/([1-9]\d*)$/.exec(notePath)
  if (!match) return undefined
  const chapter = Number(match[2])
  // The notes keep the Greek additions with Esther (/study/esther/11-16).
  const book = books.find(
    entry =>
      (entry.slug === match[1] || entry.slug === `${match[1]}-greek`) &&
      entry.chapters.includes(chapter)
  )
  return book ? `${book.id}|${chapter}` : undefined
}

/** A day's study note in full, in place of the opening lines the plan carries. */
const PublishedNoteSlice = ({ id, notePath }: { id: string; notePath: string }) => {
  const note = usePublishedNote(notePath)
  const { open } = useOpenSiteLink()
  if (note.isPending) return <Loading />
  if (!note.data) {
    // A note not published yet (or not reachable): the chapter is still read, never left out.
    const chapters = noteChapter(notePath)
    return chapters ? <ChapterSlice id={id} type="Chapter" chapters={chapters} /> : null
  }
  return (
    <Box className="px-[20px]">
      <ClassNotesBlocks blocks={note.data.blocks} onLinkPress={open} />
    </Box>
  )
}

const TextSlice = ({ id, description, subType, planLanguage, notePath }: Props) => {
  const isDevotional = subType === 'devotional'
  const fontFamily = resolveFontFamily(useSelector(selectFontFamily))
  if (notePath) return <PublishedNoteSlice id={id} notePath={notePath} />
  const content = isDevotional
    ? description.replace(/^\n|\n$/g, '')
    : description.replace(/^\n/, '')
  return (
    <Box
      className={twMerge(
        'overflow-hidden border-continuous px-[20px]',
        isDevotional && 'bg-light-grey py-[20px] mb-[32px]'
      )}
    >
      {isDevotional && (
        <FeatherIcon color="primary" name="minus" style={{ marginBottom: 20 }} size={30} />
      )}
      <ReferenceParagraph
        scaleLineHeight={1}
        planLanguage={planLanguage}
        style={{ textAlign: isDevotional ? 'center' : 'left', fontFamily }}
        className={twMerge(isDevotional ? 'text-primary' : 'text-default')}
      >
        {content}
      </ReferenceParagraph>
      {isDevotional && (
        <FeatherIcon color="primary" name="minus" style={{ marginTop: 20 }} size={30} />
      )}
    </Box>
  )
}

export default TextSlice
