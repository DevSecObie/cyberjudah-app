import { useQuery } from '@tanstack/react-query'
import { useRecordHistory } from '~features/history/useRecordHistory'
import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ScrollView, useWindowDimensions } from 'react-native'
import Header from '~common/Header'
import Loading from '~common/Loading'
import Box, { SafeAreaBox, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import ClassNotesPdfButton from '~features/notesExport/ClassNotesPdfButton'
import { longDate } from '~features/notesExport/longDate'
import ClassNotesList from '~features/passageMediaLibrary/ClassNotesList'
import {
  classNotesToBlocks,
  loadPublishedNote,
} from '~features/passageMediaLibrary/cyberJudahClasses'
import { resolveFontFamily } from '~themes/styleValues'
import { useTheme } from '~themes/ThemeProvider'
import { finishReading, noteReadingKey } from '~features/plans/finishedReading'
import ChapterSlice from '~features/plans/PlanSliceScreen/ChapterSlice'
import { noteChapter } from './noteChapter'
import { useOpenSiteLink } from './siteLinks'
import { StudyHeading } from './studyKit'

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
  const { width: windowWidth } = useWindowDimensions()
  // The pane's own width: on a wide screen the page shares the window with other panes.
  const [width, setWidth] = useState(windowWidth)
  const note = usePublishedNote(path)
  const contentWidth = Math.min(width - 32, 720)
  // A day's note not published yet: the chapter itself is read in its place, never left out.
  const chapter = note.isError ? noteChapter(path) : undefined
  const isEncyclopedia = path.startsWith('/encyclopedia')

  // Reopened from Pick up and History, like Bible Strong's own pages.
  useRecordHistory(
    note.data?.title
      ? {
          type: 'cyberjudah',
          kind: path.startsWith('/encyclopedia') ? 'topic' : 'note',
          title: note.data.title,
          subtitle: path.startsWith('/encyclopedia') ? 'Encyclopedia' : undefined,
          pathname: '/(explore)/published-note',
          params: { path },
        }
      : null
  )
  return (
    <SafeAreaBox
      className="overflow-hidden border-continuous bg-reverse"
      onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}
    >
      <Header
        hasBackButton
        title={isEncyclopedia ? 'Encyclopedia' : (note.data?.title ?? chapter?.title ?? '')}
        rightComponent={
          path && !chapter ? (
            <ClassNotesPdfButton notesPath={path} blocks={note.data?.blocks} />
          ) : undefined
        }
      />
      {note.isPending ? (
        <Loading />
      ) : note.data ? (
        // The note in the app's own views, laid out a block at a time as it scrolls.
        <ClassNotesList
          blocks={note.data.blocks}
          topics={note.data.topics}
          width={contentWidth}
          onLinkPress={open}
          // Reaching the last block is reading the note; the plan ticks it on the way back.
          onFinished={() => finishReading(noteReadingKey(path))}
          header={
            isEncyclopedia ? (
              // An encyclopedia entry opens as Bible Strong's dictionary entry: its kind, its
              // title, then the entry book by book (its summary opens the body).
              <VStack className="gap-[16px] mb-[12px] self-center" style={{ width: contentWidth }}>
                <StudyHeading
                  kind="dictionary"
                  kindLabel="Encyclopedia"
                  title={note.data.title ?? ''}
                />
              </VStack>
            ) : (
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
            )
          }
        />
      ) : chapter ? (
        <ScrollView
          contentContainerStyle={{ width: contentWidth, alignSelf: 'center', paddingBottom: 48 }}
          scrollEventThrottle={200}
          onScroll={({ nativeEvent: { layoutMeasurement, contentOffset, contentSize } }) => {
            // Reaching the end of the chapter is reading the day's note for it.
            if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 80)
              finishReading(noteReadingKey(path))
          }}
        >
          <ChapterSlice id={path} type="Chapter" chapters={chapter.chapters} />
        </ScrollView>
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
