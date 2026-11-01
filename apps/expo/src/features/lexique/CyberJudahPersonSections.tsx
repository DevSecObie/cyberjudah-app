import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Linking } from 'react-native'
import Box, { HStack, TouchableBox, VStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import ClassVideoEmbed, { secondsOfClock } from '~features/passageMediaLibrary/ClassVideoEmbed'
import { readCachedClassLibrary } from '~features/passageMediaLibrary/cyberJudahClasses'
import { cyberJudahSiteLinkToOsis } from '~helpers/cyberJudahSiteLinks'
import { resolveFontFamily } from '~themes/styleValues'
import { useTheme } from '~themes/ThemeProvider'
import {
  howWeKnow,
  loadCyberJudahPerson,
  loadVerseText,
  orderTeachings,
  ownPoints,
  verseSiteUrl,
  type PersonTeaching,
} from './cyberJudahPerson'
import { StrongEditorialSection } from './StrongDetailUI'

const TAUGHT_FIRST = 3
const TAUGHT_MORE = 6
const CLASSES_FIRST = 5
const CLASSES_MORE = 10

const formatDate = (date?: string | null) => {
  if (!date) return ''
  const parsed = new Date(`${date}T12:00:00Z`)
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const titleWithCount = (title: string, count: number) => (count ? `${title} · ${count}` : title)

const More = ({
  shown,
  total,
  step,
  onMore,
}: {
  shown: number
  total: number
  step: number
  onMore: (next: number) => void
}) =>
  shown >= total ? null : (
    <TouchableBox
      accessibilityRole="button"
      className="py-[8px]"
      onPress={() => onMore(shown + step)}
    >
      <Text className="text-primary text-[14px] font-bold">
        Show {Math.min(step, total - shown)} more
        <Text className="text-tertiary text-[14px]"> · {total - shown} left</Text>
      </Text>
    </TouchableBox>
  )

/** A verse the classes taught on, as the Telegram app's scripture card: the verse, their points, the class. */
const TaughtCard = ({
  teaching,
  onOpenBibleReference,
  onOpenClass,
}: {
  teaching: PersonTeaching
  onOpenBibleReference: (osis: string) => void
  onOpenClass: (notesPath: string) => void
}) => {
  const theme = useTheme()
  const range = /:(\d+)-(\d+)$/.exec(teaching.verse)
  const url = range
    ? `${teaching.url.replace(/#v\d+$/, '')}#v${range[1]}-${range[2]}`
    : teaching.url
  const text = useQuery({
    queryKey: ['cyberjudah-verse-text', url],
    queryFn: () => loadVerseText(url),
    staleTime: Infinity,
  })
  const points = ownPoints(teaching.points ?? [], text.data ?? '')
  const osis = cyberJudahSiteLinkToOsis(verseSiteUrl(teaching.url))
  const classMeta = [
    teaching.note.teacher,
    formatDate(teaching.note.date),
    teaching.ts ? `from ${teaching.ts}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <VStack className="rounded-[16px] border-[1px] border-border p-[16px] gap-[12px]">
      <TouchableBox
        accessibilityRole="link"
        disabled={!osis}
        onPress={() => osis && onOpenBibleReference(osis)}
        className="gap-[10px]"
      >
        <HStack className="items-center justify-between">
          <Text className="font-bold text-[18px]">{teaching.verse}</Text>
          <Text className="text-tertiary text-[12px] font-bold">KJV</Text>
        </HStack>
        {!!text.data && (
          <Box
            style={{ borderLeftWidth: 3, borderLeftColor: theme.colors.border, paddingLeft: 14 }}
          >
            <Text
              className="text-[18px] leading-[28px]"
              style={{ fontFamily: resolveFontFamily(theme.fontFamily.title) }}
            >
              {text.data}
            </Text>
          </Box>
        )}
      </TouchableBox>
      {points.length > 0 && (
        <VStack className="gap-[8px] pt-[12px] border-t-[1px] border-border">
          {points.map((point, index) => (
            <Text key={index} className="text-grey text-[16px] leading-[23px]">
              {point}
            </Text>
          ))}
        </VStack>
      )}
      {teaching.video ? (
        <ClassVideoEmbed
          videoId={teaching.video}
          start={teaching.t ?? secondsOfClock(teaching.ts)}
          title={teaching.note.label}
          meta={classMeta}
          onOpenClass={() => onOpenClass(teaching.note.url)}
        />
      ) : (
        <TouchableBox
          accessibilityRole="link"
          onPress={() => onOpenClass(teaching.note.url)}
          className="gap-[2px]"
        >
          <Text className="font-bold text-[15px]">{teaching.note.label}</Text>
          <Text className="text-tertiary text-[14px]">{classMeta}</Text>
        </TouchableBox>
      )}
    </VStack>
  )
}

/** The Telegram app's person sections, below the Relationships graph. */
export default function CyberJudahPersonSections({
  uniqueName,
  onOpenBibleReference,
  onOpenEntityProfile,
}: {
  uniqueName: string
  onOpenBibleReference: (osis: string) => void
  onOpenEntityProfile: (entityKey: string) => void
}) {
  const router = useRouter()
  const [taughtShown, setTaughtShown] = useState(TAUGHT_FIRST)
  const [classesShown, setClassesShown] = useState(CLASSES_FIRST)
  const person = useQuery({
    queryKey: ['cyberjudah-person', uniqueName],
    queryFn: () => loadCyberJudahPerson(uniqueName),
    staleTime: 60 * 60 * 1000,
    networkMode: 'always',
    retry: 1,
  })
  if (!person.data) return null
  const known = howWeKnow(person.data)
  const taught = orderTeachings(person.data.taught)
  const { classes, cases } = person.data

  const openVerse = (path: string) => {
    const osis = cyberJudahSiteLinkToOsis(verseSiteUrl(path))
    if (osis) onOpenBibleReference(osis)
  }
  // A class in the library opens in its player; any other note opens on the website.
  const openClass = (notesPath: string) => {
    const item = readCachedClassLibrary()?.find(entry => entry.notesPath === notesPath)
    if (item)
      router.push({ pathname: '/(explore)/passage-media-player', params: { workId: item.workId } })
    else void Linking.openURL(`https://cyberjudah.io${notesPath}`)
  }

  return (
    <>
      {known.length > 0 && (
        <StrongEditorialSection title={titleWithCount('How we know', known.length)} separated>
          <VStack className="gap-[14px]">
            {known.map(({ label, link }, index) => (
              <VStack key={`${label}:${link.id}:${index}`} className="gap-[2px]">
                <Text className="text-[16px]">
                  {label}:{' '}
                  <Text
                    className="text-primary text-[16px]"
                    onPress={() => onOpenEntityProfile(link.id)}
                  >
                    {link.name}
                  </Text>
                </Text>
                {!!link.verses?.length && (
                  <Text className="text-tertiary text-[15px]">
                    {link.verses.map((path, verseIndex) => (
                      <Text
                        key={path}
                        className="text-tertiary text-[15px]"
                        onPress={() => openVerse(path)}
                      >
                        {verseIndex ? ', ' : ''}
                        {verseLabel(path)}
                      </Text>
                    ))}
                  </Text>
                )}
                {!!link.note && <Text className="text-tertiary text-[14px]">{link.note}</Text>}
              </VStack>
            ))}
          </VStack>
        </StrongEditorialSection>
      )}

      <StrongEditorialSection
        title={titleWithCount('What the classes taught', taught.length)}
        separated
      >
        {taught.length ? (
          <VStack className="gap-[14px]">
            {taught.slice(0, taughtShown).map((teaching, index) => (
              <TaughtCard
                key={`${teaching.note.url}:${index}`}
                teaching={teaching}
                onOpenBibleReference={onOpenBibleReference}
                onOpenClass={openClass}
              />
            ))}
            <More
              shown={taughtShown}
              total={taught.length}
              step={TAUGHT_MORE}
              onMore={setTaughtShown}
            />
          </VStack>
        ) : (
          <Text className="text-tertiary">
            No class has taught on {person.data.name} by name yet.
          </Text>
        )}
      </StrongEditorialSection>

      {classes.length > 0 && (
        <StrongEditorialSection
          title={titleWithCount(`Classes that read of ${person.data.name}`, classes.length)}
          separated
        >
          <VStack>
            {classes.slice(0, classesShown).map(item => (
              <TouchableBox
                key={item.url}
                accessibilityRole="link"
                onPress={() => openClass(item.url)}
                className="flex-row items-center gap-[10px] py-[12px] border-b-[1px] border-border"
              >
                <VStack className="flex-[1] gap-[2px]">
                  <Text className="text-primary text-[12px] font-bold">
                    {item.collection || 'Class'}
                  </Text>
                  <Text className="text-[16px]">{item.title}</Text>
                  <Text className="text-tertiary text-[13px]">
                    {[item.verse, formatDate(item.date)].filter(Boolean).join(' · ')}
                  </Text>
                </VStack>
                <FeatherIcon name="chevron-right" size={18} color="tertiary" />
              </TouchableBox>
            ))}
            <More
              shown={classesShown}
              total={classes.length}
              step={CLASSES_MORE}
              onMore={setClassesShown}
            />
          </VStack>
        </StrongEditorialSection>
      )}

      {cases.length > 0 && (
        <StrongEditorialSection
          title={titleWithCount('Related case studies', cases.length)}
          separated
        >
          <VStack>
            {cases.map(item => (
              <TouchableBox
                key={item.slug}
                accessibilityRole="link"
                onPress={() =>
                  router.push({ pathname: '/(explore)/case-study', params: { slug: item.slug } })
                }
                className="flex-row items-center gap-[10px] py-[12px] border-b-[1px] border-border"
              >
                <VStack className="flex-[1] gap-[2px]">
                  <Text className="text-[16px]">{item.name}</Text>
                  <Text className="text-tertiary text-[13px]">
                    {[
                      item.kind === 'blessing' ? 'Blessing' : 'Judgment',
                      item.era,
                      item.verdictLabel,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </VStack>
                <FeatherIcon name="chevron-right" size={18} color="tertiary" />
              </TouchableBox>
            ))}
          </VStack>
        </StrongEditorialSection>
      )}
    </>
  )
}

// "genesis/4/1" as "Genesis 4:1".
const verseLabel = (path: string) => {
  const [slug, chapter, verse] = path.split('/')
  const book = slug.replace(/-/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
  return `${book} ${chapter}${verse ? `:${verse}` : ''}`
}
