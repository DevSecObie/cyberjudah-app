import { useQuery } from '@tanstack/react-query'
import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ListRow } from '~common/ui/ListSection'
import { StudyMoreRow } from '~common/ui/StudySection'
import Text from '~common/ui/Text'
import { useRecordHistory } from '~features/history/useRecordHistory'
import { longDate } from '~features/notesExport/longDate'
import { loadTopic, type ThreadStop } from './classTeaching'
import { useOpenSiteLink } from './siteLinks'
import { JumpSection, ScriptureRow, StudyPage } from './studyKit'

const THREAD_FIRST = 12

/** The class that opened a scripture: who taught it, the class, and the moment. */
const openedBy = (stop: ThreadStop) => {
  const first = stop.classes[0]
  if (!first) return ''
  return [first.teacher, first.title, first.ts ? `from ${first.ts}` : '']
    .filter(Boolean)
    .join(' · ')
}

/** A topic on Bible Strong's Nave topic page: its scriptures in Bible order, then its classes. */
const TopicScreen = () => {
  const { slug = '' } = useLocalSearchParams<{ slug?: string }>()
  const { open } = useOpenSiteLink()
  const [allThread, setAllThread] = useState(false)
  const topic = useQuery({
    queryKey: ['cyberjudah-topic', slug],
    queryFn: () => loadTopic(slug),
    enabled: !!slug,
    staleTime: 60 * 60 * 1000,
    networkMode: 'always',
    retry: 1,
  })
  const data = topic.data
  const thread = data?.thread ?? []
  const notes = data?.items.filter(item => item.kind !== 'case') ?? []
  const cases = data?.items.filter(item => item.kind === 'case') ?? []

  // Reopened from Pick up and History, like Bible Strong's own pages.
  useRecordHistory(
    data?.label
      ? {
          type: 'cyberjudah',
          kind: 'topic',
          title: data.label,
          pathname: '/(explore)/topic',
          params: { slug },
        }
      : null
  )

  return (
    <StudyPage
      kind="nave"
      kindLabel="Topic"
      headerTitle="Topics"
      title={data?.label}
      isPending={topic.isPending}
      isError={topic.isError}
      errorMessage="This topic did not load. Check your connection."
      jumps={[
        ...(thread.length ? [{ id: 'scriptures', label: 'Scriptures' }] : []),
        ...(notes.length ? [{ id: 'classes', label: 'Classes' }] : []),
        ...(cases.length ? [{ id: 'cases', label: 'Cases' }] : []),
      ]}
    >
      {thread.length > 0 && (
        <JumpSection id="scriptures" title="Scriptures" surface="rows">
          {[
            ...(allThread ? thread : thread.slice(0, THREAD_FIRST)).map(stop => (
              <ScriptureRow
                key={`${stop.url}${stop.label}`}
                label={stop.label}
                text={stop.text}
                onPress={() => open(stop.url)}
                footer={
                  stop.classes[0] ? (
                    <Text
                      className="text-[13px] text-grey"
                      numberOfLines={2}
                      onPress={() => open(stop.classes[0].url)}
                    >
                      {openedBy(stop)}
                    </Text>
                  ) : null
                }
              />
            )),
            ...(!allThread && thread.length > THREAD_FIRST
              ? [
                  <StudyMoreRow
                    key="more"
                    label="All the scriptures"
                    onPress={() => setAllThread(true)}
                  />,
                ]
              : []),
          ]}
        </JumpSection>
      )}
      {notes.length > 0 && (
        <JumpSection id="classes" title="Classes" surface="rows">
          {notes.map(item => (
            <ListRow
              key={item.url}
              label={item.title}
              description={[
                item.kind === 'captains' ? 'Captains' : '',
                item.teacher,
                longDate(item.date),
              ]
                .filter(Boolean)
                .join(' · ')}
              onPress={() => open(item.url)}
            />
          ))}
        </JumpSection>
      )}
      {cases.length > 0 && (
        <JumpSection id="cases" title="Cases" surface="rows">
          {cases.map(item => (
            <ListRow
              key={item.url}
              label={item.title}
              description={[item.verdict, item.charge].filter(Boolean).join(' · ')}
              onPress={() => open(item.url)}
            />
          ))}
        </JumpSection>
      )}
    </StudyPage>
  )
}

export default TopicScreen
