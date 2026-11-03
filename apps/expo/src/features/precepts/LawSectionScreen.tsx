import { useQuery } from '@tanstack/react-query'
import { useLocalSearchParams } from 'expo-router'
import { VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { useRecordHistory } from '~features/history/useRecordHistory'
import { useOpenSiteLink } from '~features/publishedNotes/siteLinks'
import { JumpSection, ScriptureRow, StudyPage } from '~features/publishedNotes/studyKit'
import { loadLawSection, scriptureText } from './preceptsAndLaw'

/** A section of the Handbook of the Law: each law in its own card, the law and then its scriptures. */
export default function LawSectionScreen() {
  const { id = '', law = '' } = useLocalSearchParams<{ id?: string; law?: string }>()
  const { open } = useOpenSiteLink()
  const section = useQuery({
    queryKey: ['cyberjudah-law-section', id],
    queryFn: () => loadLawSection(id),
    staleTime: 60 * 60 * 1000,
    networkMode: 'always',
    retry: 3,
  })
  const data = section.data

  // Reopened from Pick up and History, like Bible Strong's own pages.
  useRecordHistory(
    data
      ? {
          type: 'cyberjudah',
          kind: 'law',
          title: `${data.id} · ${data.title}`,
          pathname: '/(explore)/law-section',
          params: { id, law },
        }
      : null
  )

  return (
    <StudyPage
      kind="commentary"
      kindLabel="The Law"
      headerTitle="The Law"
      title={data?.title}
      subtitle={data?.part.title}
      initialJump={law || undefined}
      isPending={section.isPending}
      isError={section.isError}
      errorMessage="This section did not load. Check your connection."
    >
      {data?.entries.map(entry => (
        <JumpSection key={entry.id} id={entry.id} title={entry.id} surface="rows">
          {[
            <VStack key="law" className="px-[16px] py-[12px]">
              <Text className="text-[17px] leading-[25px] font-bold">{entry.text}</Text>
            </VStack>,
            ...entry.refs.map(scripture => (
              <ScriptureRow
                key={scripture.label}
                label={scripture.label}
                text={scriptureText(scripture)}
                onPress={() => open(scripture.url)}
              />
            )),
          ]}
        </JumpSection>
      ))}
    </StudyPage>
  )
}
