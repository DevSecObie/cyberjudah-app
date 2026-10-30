import { useQuery } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState, type ReactNode } from 'react'
import { Linking, ScrollView } from 'react-native'
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

const SCRIPTURE_FIRST = 4
const SCRIPTURE_MORE = 6
const SHOWN_VERSES = 8

const Section = ({
  title,
  count,
  children,
}: {
  title: string
  count?: number
  children: ReactNode
}) => (
  <VStack className="mt-[26px] pt-[22px] border-t-[1px] border-border gap-[12px]">
    <Text className="text-primary text-[13px] font-bold">
      {title}
      {count ? <Text className="text-tertiary text-[13px]"> · {count}</Text> : null}
    </Text>
    {children}
  </VStack>
)

const Row = ({ title, meta, onPress }: { title: string; meta?: string; onPress: () => void }) => (
  <TouchableBox
    accessibilityRole="link"
    onPress={onPress}
    className="flex-row items-center gap-[10px] py-[11px] border-b-[1px] border-border"
  >
    <VStack className="flex-[1] gap-[2px]">
      {!!meta && <Text className="text-primary text-[12px] font-bold">{meta}</Text>}
      <Text className="text-[15px]">{title}</Text>
    </VStack>
    <FeatherIcon name="chevron-right" size={18} color="tertiary" />
  </TouchableBox>
)

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
        className={`${className} text-primary`}
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
      className="flex-row items-center gap-[12px] py-[9px] border-b-[1px] border-border"
    >
      <Image
        source={getStrongEntityAvatarSource(type === 'Group' ? 'group' : 'person', type, id)}
        style={{ width: 36, height: 36, borderRadius: 18 }}
        contentFit="cover"
      />
      <Text className="flex-[1] text-[16px]">{name}</Text>
      <FeatherIcon name="chevron-right" size={18} color="tertiary" />
    </TouchableBox>
  )
}

/** One of the case's passages: its first verses (all of it in the reader). */
const Scripture = ({ scripture, onOpen }: { scripture: CaseScripture; onOpen: () => void }) => {
  const theme = useTheme()
  const verses = scripture.text.slice(0, SHOWN_VERSES)
  return (
    <TouchableBox
      accessibilityRole="link"
      onPress={onOpen}
      className="rounded-[16px] border-[1px] border-border p-[16px] gap-[10px]"
    >
      <HStack className="items-center justify-between">
        <Text className="font-bold text-[17px]">{scripture.label}</Text>
        <Text className="text-tertiary text-[12px] font-bold">KJV</Text>
      </HStack>
      <Box style={{ borderLeftWidth: 3, borderLeftColor: theme.colors.border, paddingLeft: 14 }}>
        <Text
          className="text-[17px] leading-[27px]"
          style={{ fontFamily: resolveFontFamily(theme.fontFamily.title) }}
        >
          {verses.map(verse => (
            <Text key={verse.verse} className="text-[17px] leading-[27px]">
              <Text className="text-primary text-[11px] font-bold">{verse.verse} </Text>
              {verse.text}{' '}
            </Text>
          ))}
          {scripture.text.length > verses.length ? '…' : ''}
        </Text>
      </Box>
    </TouchableBox>
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
  const site = (path: string) => void Linking.openURL(`https://cyberjudah.io${path}`)
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

  return (
    <SafeAreaBox className="overflow-hidden border-continuous bg-reverse">
      <Header hasBackButton background title={k?.name ?? 'Case study'} />
      {study.isPending ? (
        <Loading />
      ) : !k ? (
        <Box className="py-[60px] px-[20px] items-center">
          <Text className="text-grey text-center">
            This case did not load. Check your connection.
          </Text>
        </Box>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: 20,
            paddingBottom: 60,
            maxWidth: 640,
            alignSelf: 'center',
            width: '100%',
          }}
        >
          <Text className="text-primary text-[12px] font-bold">
            {[kindName(k.kind), k.era, k.code].filter(Boolean).join(' · ')}
          </Text>
          <Text
            className="text-[26px] leading-[32px] mt-[6px]"
            style={{ fontFamily: resolveFontFamily(theme.fontFamily.title) }}
          >
            {k.name}
          </Text>
          <Text
            className={`text-[15px] font-bold mt-[6px] ${blessing ? 'text-success' : 'text-quart'}`}
          >
            {k.verdictLabel ?? k.verdict}
          </Text>
          <VStack className="mt-[16px] rounded-[14px] bg-light-grey p-[16px] gap-[4px]">
            <Text className="text-tertiary text-[12px] font-bold">
              {blessing ? 'What was kept' : 'The charge'}
            </Text>
            <RefText text={k.charge} className="text-[17px] leading-[25px]" onOpenOsis={openOsis} />
          </VStack>
          {!!k.summary && (
            <Box className="mt-[16px]">
              <RefText
                text={k.summary}
                className="text-[16px] leading-[25px]"
                onOpenOsis={openOsis}
              />
            </Box>
          )}

          {!!k.people?.length && (
            <Section title="People in this case">
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
            </Section>
          )}
          {offense.length > 0 && (
            <Section title={blessing ? 'The obedience' : 'The offense'}>{prose(offense)}</Section>
          )}
          {judgment.length > 0 && (
            <Section title={blessing ? 'The blessing' : 'The judgment'}>{prose(judgment)}</Section>
          )}
          {refs.length > 0 && (
            <Section title="Scripture" count={refs.length}>
              {refs.slice(0, shown).map(ref => (
                <Scripture key={ref.label} scripture={ref} onOpen={() => openVerse(ref.url)} />
              ))}
              {shown < refs.length && (
                <TouchableBox
                  accessibilityRole="button"
                  onPress={() => setShown(shown + SCRIPTURE_MORE)}
                >
                  <Text className="text-primary text-[14px] font-bold">
                    Show {Math.min(SCRIPTURE_MORE, refs.length - shown)} more
                    <Text className="text-tertiary text-[14px]"> · {refs.length - shown} left</Text>
                  </Text>
                </TouchableBox>
              )}
            </Section>
          )}
          {!!k.lawsResolved?.length && (
            <Section title="The law">
              {k.lawsResolved.map(law => (
                <VStack key={law.id} className="py-[8px] gap-[2px]">
                  <Text className="text-primary text-[12px] font-bold">{law.id}</Text>
                  <Text className="text-[15px] leading-[22px]">{law.text}</Text>
                </VStack>
              ))}
            </Section>
          )}
          {!!k.preceptsResolved?.some(precept => precept.url) && (
            <Section title="Precepts">
              <HStack className="flex-wrap gap-[8px]">
                {k.preceptsResolved
                  .filter(precept => precept.url)
                  .map(precept => (
                    <TouchableBox
                      key={precept.slug}
                      accessibilityRole="link"
                      onPress={() => site(precept.url!)}
                      className="rounded-[14px] bg-light-grey px-[12px] py-[6px]"
                    >
                      <Text className="text-[14px]">{precept.title}</Text>
                    </TouchableBox>
                  ))}
              </HStack>
            </Section>
          )}
          {!!k.related?.some(related => related.url) && (
            <Section title="Related cases">
              {k.related
                .filter(related => related.url)
                .map(related => (
                  <Row
                    key={related.slug}
                    title={related.name}
                    meta={related.desc || related.charge}
                    onPress={() => openPage(related.url!)}
                  />
                ))}
            </Section>
          )}
          {!!k.taught?.length && (
            <Section title="Taught in">
              {k.taught.map(taught => (
                <Row
                  key={taught.url}
                  title={taught.title}
                  meta={taught.range}
                  onPress={() => openPage(taught.url)}
                />
              ))}
            </Section>
          )}
          {!!k.see?.length && (
            <Section title="See also">
              {k.see.map(see => (
                <Row key={see.url} title={see.title} onPress={() => site(see.url)} />
              ))}
            </Section>
          )}
        </ScrollView>
      )}
    </SafeAreaBox>
  )
}

export default CaseStudyScreen
