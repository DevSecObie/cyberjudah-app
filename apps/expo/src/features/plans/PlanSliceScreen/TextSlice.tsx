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
import ReferenceParagraph from './ReferenceParagraph'

type Props = TextSliceProps & {
  planLanguage?: Plan['lang']
}

/** A day's study note in full, in place of the opening lines the plan carries. */
const PublishedNoteSlice = ({ notePath }: { notePath: string }) => {
  const note = usePublishedNote(notePath)
  const { open } = useOpenSiteLink()
  if (note.isPending) return <Loading />
  if (!note.data) return null
  return (
    <Box className="px-[20px]">
      <ClassNotesBlocks blocks={note.data.blocks} onLinkPress={open} />
    </Box>
  )
}

const TextSlice = ({ description, subType, planLanguage, notePath }: Props) => {
  const isDevotional = subType === 'devotional'
  const fontFamily = resolveFontFamily(useSelector(selectFontFamily))
  if (notePath) return <PublishedNoteSlice notePath={notePath} />
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
