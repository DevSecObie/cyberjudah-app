import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { SectionList } from 'react-native'
import PanelSearch from '~common/ContextualPanel/PanelSearch'
import FiltersHeader from '~common/FiltersHeader'
import Loading from '~common/Loading'
import Box, { SafeAreaBox, TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import {
  loadStudyNotes,
  readCachedStudyNotes,
  studyNoteHeading,
  studySections,
} from './publishedNotes'

/** "4 Chapters a Day": a study note for every chapter, book by book, with a search (as in Telegram). */
const StudyNotesScreen = () => {
  const router = useRouter()
  const notes = useQuery({
    queryKey: ['cyberjudah-study-notes'],
    queryFn: () => loadStudyNotes(),
    initialData: readCachedStudyNotes() ?? undefined,
    staleTime: 60 * 60 * 1000,
    networkMode: 'always',
    retry: 1,
  })
  const [query, setQuery] = useState('')
  const sections = useMemo(() => studySections(notes.data, query), [notes.data, query])

  return (
    <SafeAreaBox className="overflow-hidden border-continuous bg-reverse">
      <FiltersHeader
        hasBackButton
        title="4 Chapters a Day"
        onReset={() => setQuery('')}
        filters={[
          {
            key: 'search',
            icon: 'search',
            label: 'Search',
            value: query.trim() || undefined,
            active: !!query.trim(),
            onPress: () => {},
            content: () => <PanelSearch value={query} onChange={setQuery} />,
          },
        ]}
      />
      {notes.isPending ? (
        <Loading />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.url}
          stickySectionHeadersEnabled
          contentContainerStyle={{ paddingBottom: 48 }}
          renderSectionHeader={({ section }) => (
            <Box className="bg-light-grey px-[20px] py-[8px]">
              <Text className="text-[13px] font-bold text-tertiary">{section.title}</Text>
            </Box>
          )}
          renderItem={({ item }) => (
            <TouchableBox
              accessibilityRole="button"
              className="px-[20px] py-[14px] border-b-[1px] border-border gap-[3px]"
              onPress={() =>
                router.push({ pathname: '/(explore)/published-note', params: { path: item.url } })
              }
            >
              {!!item.range && (
                <Text className="text-primary text-[12px] font-bold">{item.range}</Text>
              )}
              <Text className="font-bold text-[16px]" numberOfLines={2}>
                {studyNoteHeading(item.title)}
              </Text>
            </TouchableBox>
          )}
          ListEmptyComponent={
            <Box className="py-[60px] px-[20px] items-center">
              <Text className="text-grey text-center">
                {notes.isError
                  ? 'The study notes did not load. Check your connection.'
                  : 'No study note found. Try a book or a chapter.'}
              </Text>
            </Box>
          }
        />
      )}
    </SafeAreaBox>
  )
}

export default StudyNotesScreen
