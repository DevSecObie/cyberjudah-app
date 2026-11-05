import { radii } from '~common/ui/surfaces'
import { useQuery } from '@tanstack/react-query'
import { useRecordHistory } from '~features/history/useRecordHistory'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState, type ReactNode } from 'react'
import { ScrollView } from 'react-native'
import { useOpenSiteLink } from '~features/publishedNotes/siteLinks'
import { ChipRow, JumpSection, ScriptureRow, StudyPage } from '~features/publishedNotes/studyKit'
import { ListRow } from '~common/ui/ListSection'
import { StudyMoreRow } from '~common/ui/StudySection'
import Header from '~common/Header'
import Loading from '~common/Loading'
import Box, { HStack, SafeAreaBox, TouchableBox, VStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { getCommentaryBibleViewRoute } from '~features/commentaries/commentaryReferenceNavigation'
import { createStrongDetailRoute } from '~features/lexique/strongDetailRoutes'
import { Image } from 'expo-image'
import { getStrongEntityAvatarSource } from '~features/lexique/strongEntityAvatars'
import { loadCyberJudahPerson } from '~features/lexique/cyberJudahPerson'
import { readCachedClassLibrary } from '~features/passageMediaLibrary/cyberJudahClasses'
import { cyberJudahSiteLinkToOsis } from '~helpers/cyberJudahSiteLinks'
import { parseInlineBibleReferences } from '~helpers/bcvParser'
import { resolveFontFamily } from '~themes/styleValues'
import { useTheme } from '~themes/ThemeProvider'
import { caseSlugOf, kindName, loadCaseStudy, type CaseScripture } from './caseStudies'
import ClassVideoEmbed, { useClassVideoOf } from '~features/passageMediaLibrary/ClassVideoEmbed'

const SCRIPTURE_FIRST = 4
const SHOWN_VERSES = 8

/** Case text with every scripture reference in it opening the passage in the Bible. */
const RefText = ({
  text,
  className,
  onOpenOsis,
}: {
  text: string
  className: string
  onOpenOsis: (osis: string) => void
}) => {
  const parts: ReactNode[] = []
  let at = 0
  for (const reference of parseInlineBibleReferences(text, 'en')) {
    if (reference.start > at) parts.push(text.slice(at, reference.start))
    parts.push(
      <Text
        key={reference.start}
        className={`${className} text-link`}
        accessibilityRole="link"
        onPress={() => onOpenOsis(reference.target.osis)}
      >
        {reference.text}
      </Text>
    )
    at = reference.end
  }
  if (at < text.length) parts.push(text.slice(at))
  return <Text className={className}>{parts}</Text>
}

/** A person in the case: their portrait (or the avatar for a man or a woman), as in Telegram. */
const PersonRow = ({ id, name, onPress }: { id: string; name: string; onPress: () => void }) => {
  const person = useQuery({
    queryKey: ['cyberjudah-person', id],
    queryFn: () => loadCyberJudahPerson(id),
    staleTime: 60 * 60 * 1000,
    retry: 1,
  })
  const type = (person.data as { type?: string } | undefined)?.type ?? 'Male'
  return (
    <TouchableBox
      accessibilityRole="link"
      onPress={onPress}
      className="flex-row items-center gap-[12px] px-[16px] py-[9px]"
    >
      <Image
        source={getStrongEntityAvatarSource(type === 'Group' ? 'group' : 'person', type, id)}
        style={{ width: 36, height: 36, borderRadius: radii.pill }}
        contentFit="cover"
      />
      <Text className="flex-[1] text-[16px]">{name}</Text>
      <FeatherIcon name="chevron-right" size={18} color="tertiary" />
    </TouchableBox>
  )
}

/** A class the case was taught in: its video embedded when it is a class, else a row to its notes. */
const TaughtIn = ({
  taught,
  onOpen,
}: {
  taught: { title: string; range: string; url: string }
  onOpen: () => void
}) => {
  const video = useClassVideoOf(taught.url)
  return video ? (
    <Box className="py-[6px]">
      <ClassVideoEmbed
        videoId={video}
        title={taught.title}
        meta={taught.range}
        onOpenClass={onOpen}
      />
    </Box>
  ) : (
    <ListRow label={taught.title} description={taught.range} onPress={onOpen} />
  )
}

/** A case: what happened, who it concerns, the offense and the judgment, then the scripture and the law. */
const CaseStudyScreen = () => {
  const { slug = '' } = useLocalSearchParams<{ slug?: string }>()
  const router = useRouter()
  const theme = useTheme()
  const [shown, setShown] = useState(SCRIPTURE_FIRST)
  const study = useQuery({
    queryKey: ['cyberjudah-case', slug],
    queryFn: () => loadCaseStudy(slug),
    staleTime: 60 * 60 * 1000,
    networkMode: 'always',
    retry: 1,
  })
  // Our notes, topics, precepts and classes open in the app's own pages, never in Safari.
  const { open: openSiteLink } = useOpenSiteLink()
  const site = (path: string) => openSiteLink(path)
  const openOsis = (osis: string) => {
    const route = getCommentaryBibleViewRoute(osis)
    if (route) router.push(route)
  }
  const openVerse = (url: string) => {
    const osis = cyberJudahSiteLinkToOsis(`https://cyberjudah.io${url}`)
    const route = osis && getCommentaryBibleViewRoute(osis)
    if (route) router.push(route)
    else site(url)
  }
  const openPage = (url: string) => {
    const caseSlug = caseSlugOf(url)
    const item = readCachedClassLibrary()?.find(entry => entry.notesPath === url)
    if (caseSlug) router.push({ pathname: '/(explore)/case-study', params: { slug: caseSlug } })
    else if (item)
      router.push({ pathname: '/(explore)/passage-media-player', params: { workId: item.workId } })
    else site(url)
  }

  const k = study.data
  const blessing = k?.kind === 'blessing'
  const offense = k?.offenseFull?.length ? k.offenseFull : [k?.offense].filter(Boolean)
  const judgment = k?.judgmentFull?.length ? k.judgmentFull : [k?.judgment].filter(Boolean)
  const refs = (k?.refsResolved ?? []).filter(ref => ref.slug && ref.text?.length)
  const prose = (paragraphs: (string | undefined)[]) =>
    paragraphs.map((paragraph, index) => (
      <RefText
        key={index}
        text={paragraph ?? ''}
        className="text-[16px] leading-[25px]"
        onOpenOsis={openOsis}
      />
    ))

  // Reopened from Pick up and History, like Bible Strong's own pages.
  useRecordHistory(
    study.data?.name
      ? {
          type: 'cyberjudah',
          kind: 'case',
          title: study.data.name,
          pathname: '/(explore)/case-study',
          params: { slug },
        }
      : null
  )
  const jumps = k
    ? [
        { id: 'charge', label: blessing ? 'Kept' : 'Charge' },
        ...(offense.length ? [{ id: 'offense', label: blessing ? 'Obedience' : 'Offense' }] : []),
        ...(judgment.length ? [{ id: 'judgment', label: blessing ? 'Blessing' : 'Judgment' }] : []),
        ...(refs.length ? [{ id: 'scriptures', label: 'Scriptures' }] : []),
        ...(k.lawsResolved?.length ? [{ id: 'law', label: 'Law' }] : []),
        ...(k.people?.length ? [{ id: 'people', label: 'People' }] : []),
      ]
    : undefined
  return (
    <StudyPage
      kind="strong"
      kindLabel="Case study"
      headerTitle="Case Studies"
      title={k?.name}
      subtitle={
        k ? [k.code, k.era, k.verdictLabel ?? k.verdict].filter(Boolean).join(' · ') : undefined
      }
      jumps={jumps}
      isPending={study.isPending}
      isError={study.isError}
      errorMessage="This case did not load. Check your connection."
    >
      {k && (
        <>
          <JumpSection id="charge" title={blessing ? 'What was kept' : 'The charge'}>
            <RefText text={k.charge} className="text-[17px] leading-[25px]" onOpenOsis={openOsis} />
            {!!k.summary && (
              <RefText
                text={k.summary}
                className="text-[16px] leading-[25px]"
                onOpenOsis={openOsis}
              />
            )}
          </JumpSection>
          {offense.length > 0 && (
            <JumpSection id="offense" title={blessing ? 'The obedience' : 'The offense'}>
              {prose(offense)}
            </JumpSection>
          )}
          {judgment.length > 0 && (
            <JumpSection id="judgment" title={blessing ? 'The blessing' : 'The judgment'}>
              {prose(judgment)}
            </JumpSection>
          )}
          {refs.length > 0 && (
            <JumpSection id="scriptures" title="Scriptures" surface="rows">
              {[
                ...refs.slice(0, shown).map(ref => (
                  <ScriptureRow
                    key={ref.label}
                    label={ref.label}
                    text={
                      ref.text
                        .slice(0, SHOWN_VERSES)
                        .map(verse => verse.text)
                        .join(' ') + (ref.text.length > SHOWN_VERSES ? ' …' : '')
                    }
                    onPress={() => openVerse(ref.url)}
                  />
                )),
                ...(shown < refs.length
                  ? [
                      <StudyMoreRow
                        key="more"
                        label="All the scriptures"
                        onPress={() => setShown(refs.length)}
                      />,
                    ]
                  : []),
              ]}
            </JumpSection>
          )}
          {!!k.lawsResolved?.length && (
            <JumpSection id="law" title="The law" surface="rows">
              {k.lawsResolved.map(law => (
                <VStack key={law.id} className="px-[16px] py-[12px] gap-[4px]">
                  <Text className="text-grey text-[13px] font-bold">{law.id}</Text>
                  <Text className="text-[15px] leading-[22px]">{law.text}</Text>
                </VStack>
              ))}
            </JumpSection>
          )}
          {!!k.people?.length && (
            <JumpSection id="people" title="People in this case" surface="rows">
              {k.people.map(person => (
                <PersonRow
                  key={person.id}
                  id={person.id}
                  name={person.name}
                  onPress={() =>
                    router.push(createStrongDetailRoute('entity', {}, { entityKey: person.id }))
                  }
                />
              ))}
            </JumpSection>
          )}
          {!!k.preceptsResolved?.some(precept => precept.url) && (
            <JumpSection id="precepts" title="Precepts" surface="none">
              <ChipRow
                chips={k.preceptsResolved
                  .filter(precept => precept.url)
                  .map(precept => ({ key: precept.url!, label: precept.title }))}
                onPress={site}
              />
            </JumpSection>
          )}
          {!!k.related?.some(related => related.url) && (
            <JumpSection id="related" title="Related cases" surface="rows">
              {k.related
                .filter(related => related.url)
                .map(related => (
                  <ListRow
                    key={related.slug}
                    label={related.name}
                    description={related.desc || related.charge}
                    onPress={() => openPage(related.url!)}
                  />
                ))}
            </JumpSection>
          )}
          {!!k.taught?.length && (
            <JumpSection id="taught" title="Taught in" surface="none">
              {k.taught.map(taught => (
                <TaughtIn key={taught.url} taught={taught} onOpen={() => openPage(taught.url)} />
              ))}
            </JumpSection>
          )}
          {!!k.see?.length && (
            <JumpSection id="see" title="See also" surface="rows">
              {k.see.map(see => (
                <ListRow key={see.url} label={see.title} onPress={() => site(see.url)} />
              ))}
            </JumpSection>
          )}
        </>
      )}
    </StudyPage>
  )
}

export default CaseStudyScreen
