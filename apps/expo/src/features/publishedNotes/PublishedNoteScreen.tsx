import { useQuery } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Linking, useWindowDimensions } from 'react-native'
import Header from '~common/Header'
import Loading from '~common/Loading'
import Box, { SafeAreaBox, VStack } from '~common/ui/Box'
import ScrollView from '~common/ui/ScrollView'
import Text from '~common/ui/Text'
import { getCommentaryBibleViewRoute } from '~features/commentaries/commentaryReferenceNavigation'
import ClassNotesPdfButton from '~features/notesExport/ClassNotesPdfButton'
import { longDate } from '~features/notesExport/notePdf'
import ClassNotesView from '~features/passageMediaLibrary/ClassNotesView'
import {
  classNotesToHtml,
  loadPublishedNote,
} from '~features/passageMediaLibrary/cyberJudahClasses'
import { resolveFontFamily } from '~themes/styleValues'
import { useTheme } from '~themes/ThemeProvider'
import { publishedNotePathOf } from './publishedNotes'

const KIND: Record<string, string> = { study: '4 Chapters a Day', encyclopedia: 'Encyclopedia' }

/** A study note or an encyclopedia entry, laid out like the class notes, with Save as PDF. */
const PublishedNoteScreen = () => {
  const theme = useTheme()
  const router = useRouter()
  const { path = '' } = useLocalSearchParams<{ path?: string }>()
  const { width } = useWindowDimensions()
  const note = useQuery({
    queryKey: ['cyberjudah-published-note', path],
    queryFn: async () => {
      const published = await loadPublishedNote(path)
      return { ...published, html: classNotesToHtml(published.body, '') }
    },
    enabled: !!path,
    staleTime: 60 * 60 * 1000,
    networkMode: 'always',
    retry: 1,
  })
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
        <ScrollView
          backgroundColor="reverse"
          contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 16, paddingTop: 20 }}
        >
          <VStack className="gap-[6px] mb-[12px]" style={{ width: contentWidth }}>
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
          <Box style={{ width: contentWidth }}>
            <ClassNotesView
              html={note.data.html}
              onLinkPress={href => {
                const notePath = publishedNotePathOf(href)
                if (notePath) {
                  router.push({ pathname: '/(explore)/published-note', params: { path: notePath } })
                } else if (href.startsWith('bible://')) {
                  const route = getCommentaryBibleViewRoute(href.slice('bible://'.length))
                  if (route) router.push(route)
                } else if (/^https:\/\//.test(href)) {
                  void Linking.openURL(href)
                }
              }}
            />
          </Box>
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
