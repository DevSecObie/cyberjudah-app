import { useLocalSearchParams } from 'expo-router'
import { VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import ClassVideoEmbed from '~features/passageMediaLibrary/ClassVideoEmbed'
import { useGlossary } from './GlossaryScreen'
import { clock, useOpenSiteLink } from './siteLinks'
import { ChipRow, JumpSection, LinkedScriptureRow, StudyPage } from './studyKit'

/** A word of the glossary on Bible Strong's word study page: its meaning, scriptures, and the classes that teach it. */
const GlossaryWordScreen = () => {
  const { slug = '' } = useLocalSearchParams<{ slug?: string }>()
  const { open, openMoment } = useOpenSiteLink()
  const glossary = useGlossary()
  const entry = glossary.data?.entries.find(e => e.slug === slug)

  return (
    <StudyPage
      kind="strong"
      kindLabel="Glossary"
      headerTitle="Glossary"
      title={entry?.term}
      subtitle={entry?.aliases.length ? `also ${entry.aliases.join(', ')}` : undefined}
      isPending={glossary.isPending}
      isError={glossary.isError}
      errorMessage="This word did not load. Check your connection."
      jumps={
        entry
          ? [
              { id: 'meaning', label: 'Meaning' },
              ...(entry.scripture.length ? [{ id: 'scriptures', label: 'Scriptures' }] : []),
              ...(entry.taught.length ? [{ id: 'taught', label: 'Taught in' }] : []),
              ...(entry.see.length ? [{ id: 'see', label: 'See also' }] : []),
            ]
          : undefined
      }
    >
      {entry && (
        <>
          <JumpSection id="meaning" title="Meaning">
            <Text className="text-[16px] leading-[24px]">{entry.definition}</Text>
          </JumpSection>
          {entry.scripture.length > 0 && (
            <JumpSection id="scriptures" title="Scriptures" surface="rows">
              {entry.scripture.map(ref => (
                <LinkedScriptureRow
                  key={ref.label}
                  label={ref.label}
                  url={ref.url}
                  onPress={() => open(ref.url)}
                />
              ))}
            </JumpSection>
          )}
          {entry.taught.length > 0 && (
            <JumpSection id="taught" title="Taught in" surface="none">
              <VStack className="gap-[12px]">
                {entry.taught.map(moment => (
                  <ClassVideoEmbed
                    key={`${moment.video}@${moment.seconds}`}
                    videoId={moment.video}
                    start={moment.seconds}
                    title={moment.title}
                    meta={`from ${clock(moment.seconds)}`}
                    onOpenClass={() => openMoment({ video: moment.video, t: moment.seconds })}
                  />
                ))}
              </VStack>
            </JumpSection>
          )}
          {entry.see.length > 0 && (
            <JumpSection id="see" title="See also" surface="none">
              <ChipRow
                chips={entry.see.map(ref => ({ key: ref.url, label: ref.title }))}
                onPress={open}
              />
            </JumpSection>
          )}
        </>
      )}
    </StudyPage>
  )
}

export default GlossaryWordScreen
