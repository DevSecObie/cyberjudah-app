import { useQuery } from '@tanstack/react-query'
import { useLocalSearchParams } from 'expo-router'
import { useRecordHistory } from '~features/history/useRecordHistory'
import { useOpenSiteLink } from '~features/publishedNotes/siteLinks'
import { JumpSection, ScriptureRow, StudyPage } from '~features/publishedNotes/studyKit'
import { loadPrecept, scriptureHasVerse, scriptureText } from './preceptsAndLaw'

/**
 * One precept on Bible Strong's concordance card: every scripture the classes read on it, in Bible
 * order. Opened from a verse, that verse's scripture comes first.
 */
export default function PreceptScreen() {
  const { slug = '', at = '' } = useLocalSearchParams<{ slug?: string; at?: string }>()
  const { open } = useOpenSiteLink()
  const precept = useQuery({
    queryKey: ['cyberjudah-precept', slug],
    queryFn: () => loadPrecept(slug),
    staleTime: 60 * 60 * 1000,
    networkMode: 'always',
    retry: 3,
  })
  const refs = precept.data?.refs ?? []
  const opened = at ? refs.find(scripture => scriptureHasVerse(scripture, at)) : undefined

  // Reopened from Pick up and History, like Bible Strong's own pages.
  useRecordHistory(
    precept.data?.title
      ? {
          type: 'cyberjudah',
          kind: 'precept',
          title: precept.data.title,
          pathname: '/(explore)/precept',
          params: { slug },
        }
      : null
  )

  return (
    <StudyPage
      kind="strong"
      kindLabel="Precept"
      headerTitle="Precepts"
      title={precept.data?.title}
      isPending={precept.isPending}
      isError={precept.isError}
      errorMessage="This precept did not load. Check your connection."
    >
      {opened && (
        <JumpSection id="opened" title="This verse" surface="rows">
          <ScriptureRow
            label={opened.label}
            text={scriptureText(opened)}
            onPress={() => open(opened.url)}
          />
        </JumpSection>
      )}
      {refs.length > 0 && (
        <JumpSection id="scriptures" title="Scriptures" surface="rows">
          {refs.map(scripture => (
            <ScriptureRow
              key={scripture.label}
              label={scripture.label}
              text={scriptureText(scripture)}
              onPress={() => open(scripture.url)}
            />
          ))}
        </JumpSection>
      )}
    </StudyPage>
  )
}
