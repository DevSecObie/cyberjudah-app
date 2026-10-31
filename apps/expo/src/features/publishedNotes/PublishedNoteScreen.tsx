import { useQuery } from '@tanstack/react-query'
import { useLocalSearchParams } from 'expo-router'
import { useWindowDimensions } from 'react-native'
import Header from '~common/Header'
import Loading from '~common/Loading'
import Box, { SafeAreaBox, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import ClassNotesPdfButton from '~features/notesExport/ClassNotesPdfButton'
import { longDate } from '~features/notesExport/notePdf'
import ClassNotesList from '~features/passageMediaLibrary/ClassNotesList'
import {
  classNotesToBlocks,
  loadPublishedNote,
} from '~features/passageMediaLibrary/cyberJudahClasses'
import { resolveFontFamily } from '~themes/styleValues'
import { useTheme } from '~themes/ThemeProvider'
import { useOpenSiteLink } from './siteLinks'

const KIND: Record<string, string> = { study: '4 Chapters a Day', encyclopedia: 'Encyclopedia' }

/** A published note, loaded and cut into blocks; shared by the note page and the plan day reader. */
export const usePublishedNote = (path: string) =>
  useQuery({
    queryKey: ['cyberjudah-published-note', path],
    queryFn: async () => {
      const published = await loadPublishedNote(path)
      // "Read the chapter → Genesis 2" is the website's link; the app opens the chapter elsewhere.
      const body = published.body.replace(/^Read the chapter →.*\n?/m, '')
      return { ...published, blocks: classNotesToBlocks(body, '') }
    },
    enabled: !!path,
    staleTime: 60 * 60 * 1000,
    networkMode: 'always',
    retry: 1,
  })

/** A study note or an encyclopedia entry, laid out like the class notes, with Save as PDF. */
const PublishedNoteScreen = () => {
  const theme = useTheme()
  const { open } = useOpenSiteLink()
  const { path = '' } = useLocalSearchParams<{ path?: string }>()
  const { width } = useWindowDimensions()
  const note = usePublishedNote(path)
  const contentWidth = Math.min(width - 32, 720)

  return (
    <SafeAreaBox className="overflow-hidden border-continuous bg-reverse">
      <Header
        hasBackButton
        title={note.data?.title ?? ''}
        rightComponent={path ? <ClassNotesPdfButton notesPath={path} /> : undefined}
      />
      {note.isPending ? (
        <Loading />
      ) : note.data ? (
        // The note in the app's own views, laid out a block at a time as it scrolls.
        <ClassNotesList
          blocks={note.data.blocks}
          width={contentWidth}
          onLinkPress={open}
          header={
            <VStack className="gap-[6px] mb-[12px] self-center" style={{ width: contentWidth }}>
              <Text
                className="text-[24px] leading-[30px]"
                style={{ fontFamily: resolveFontFamily(theme.fontFamily.title) }}
              >
                {note.data.title}
              </Text>
              <Text className="text-grey text-[14px]">
                {[KIND[note.data.kind ?? ''], longDate(note.data.date), note.data.teacher]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </VStack>
          }
        />
      ) : (
        <Box className="py-[60px] px-[20px] items-center">
          <Text className="text-grey text-center">
            This note did not load. Check your connection.
          </Text>
        </Box>
      )}
    </SafeAreaBox>
  )
}

export default PublishedNoteScreen
