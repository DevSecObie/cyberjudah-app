import { useQuery } from '@tanstack/react-query'
import type { PassageTarget } from '@bible-strong/ai-contract/contract'
import { ActivityIndicator, Pressable, useWindowDimensions } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import Box, { HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import SectionCard, { SectionCardHeader } from '~common/ui/SectionCard'
import Switch from '~common/ui/Switch'
import { FeatherIcon } from '~common/ui/Icon'
import { useResourceAccess } from '~features/resources/resourceAccess'
import verseToReference from '~helpers/verseToReference'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { useTheme } from '~themes/ThemeProvider'
import { loadWidgetPassage } from './widgets/passageData'
import { textDifferences } from './widgets/textDifferences'

const passageQueryKey = (p: PassageTarget) => [
  'ask-study-passage',
  p.version,
  p.book,
  p.chapter,
  p.start,
  p.end,
]

function PassageCard({
  passage,
  reference,
  highlight,
  divider,
}: {
  passage: PassageTarget
  reference?: PassageTarget
  highlight: boolean
  divider: boolean
}) {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const resources = useResourceAccess()
  const navigate = usePushRouteOnce()
  const label = verseToReference({
    bookNum: passage.book,
    chapterNum: passage.chapter,
    verses: Array.from({ length: passage.end - passage.start + 1 }, (_, i) => passage.start + i),
  })
  const query = useQuery({
    queryKey: passageQueryKey(passage),
    queryFn: ({ signal }) => loadWidgetPassage(passage, resources.bibleContent, signal),
    staleTime: 300000,
    retry: false,
  })
  const baseline = useQuery({
    queryKey: passageQueryKey(reference || passage),
    queryFn: ({ signal }) =>
      loadWidgetPassage(reference || passage, resources.bibleContent, signal),
    enabled: !!reference && highlight,
    staleTime: 300000,
    retry: false,
  })
  const referenceText = highlight && reference && baseline.data?.map(v => v.text).join(' ')
  return (
    <Box className={divider ? 'min-w-0 flex-1 border-r border-border' : 'min-w-0 flex-1'}>
      <SectionCardHeader className="min-h-24 flex-col items-start gap-0 px-3 py-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('assistant.widgets.open', { reference: label })}
          className="min-h-11 w-full flex-row items-center gap-1"
          onPress={() =>
            navigate({
              pathname: '/bible-view',
              params: {
                book: String(passage.book),
                chapter: String(passage.chapter),
                verse: String(passage.start),
                version: passage.version,
                focusVerses: JSON.stringify(
                  Array.from(
                    { length: passage.end - passage.start + 1 },
                    (_, i) => passage.start + i
                  )
                ),
                contextDisplayMode: 'focused',
              },
            })
          }
        >
          <Text className="flex-1 font-bold text-default">{label}</Text>
          <FeatherIcon name="arrow-up-right" size={16} color="grey" />
        </Pressable>
        <Text className="text-xs text-grey">{passage.version}</Text>
      </SectionCardHeader>
      <Box className="gap-3 p-3">
        {query.isPending ? (
          <ActivityIndicator color={colors.grey} accessibilityLabel={t('Chargement...')} />
        ) : query.isError ? (
          <>
            <Text className="text-sm text-grey">{t('assistant.widgets.unavailable')}</Text>
            <Pressable
              accessibilityRole="button"
              className="min-h-11 justify-center"
              onPress={() => void query.refetch()}
            >
              <Text className="text-default underline">{t('assistant.errors.retry')}</Text>
            </Pressable>
          </>
        ) : (
          query.data.map(verse => (
            <Text key={verse.number} selectable>
              <Text className="text-xs text-grey">{verse.number} </Text>
              {referenceText
                ? textDifferences(verse.text, referenceText).map((part, i) => (
                    <Text key={i} className={part.different ? 'bg-opacity5 font-bold' : undefined}>
                      {part.text}
                    </Text>
                  ))
                : verse.text}
            </Text>
          ))
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('askStudy.readContextFor', { reference: label })}
          className="min-h-11 flex-row items-start gap-2 pt-2"
          onPress={() =>
            navigate({
              pathname: '/bible-view',
              params: {
                book: String(passage.book),
                chapter: String(passage.chapter),
                verse: String(passage.start),
                version: passage.version,
                contextDisplayMode: 'fullChapter',
              },
            })
          }
        >
          <FeatherIcon name="book-open" size={16} color="grey" />
          <Text className="flex-1 text-sm text-default underline">{t('askStudy.readContext')}</Text>
        </Pressable>
      </Box>
    </Box>
  )
}

function ComparisonGroup({
  passages,
  compareWords,
}: {
  passages: PassageTarget[]
  compareWords: boolean
}) {
  const { t } = useTranslation()
  const { width, fontScale } = useWindowDimensions()
  const [highlight, setHighlight] = useState(false)
  const comparing = compareWords && passages.length === 2
  // One shared comparison, including on iPhone. Stack only when accessibility text
  // or a very narrow viewport would make the two columns unreadable.
  const sideBySide = comparing && width >= 360 && fontScale <= 1.3
  return (
    <SectionCard className="mx-0 mb-0 bg-light-grey">
      {comparing && (
        <HStack className="items-center justify-between gap-3 p-3">
          <Text className="flex-1 text-sm text-grey">
            {t('assistant.widgets.highlightDifferences')}
          </Text>
          <Switch
            accessibilityLabel={t('assistant.widgets.highlightDifferences')}
            value={highlight}
            onValueChange={setHighlight}
          />
        </HStack>
      )}
      <Box
        testID="ask-verse-comparison-columns"
        className={sideBySide ? 'flex-row items-stretch' : 'flex-col'}
      >
        {passages.map((passage, index) => (
          <PassageCard
            key={`${passage.version}:${passage.book}:${passage.chapter}:${passage.start}:${passage.end}`}
            passage={passage}
            reference={comparing ? passages[index === 0 ? 1 : 0] : undefined}
            highlight={highlight}
            divider={sideBySide && index === 0}
          />
        ))}
      </Box>
    </SectionCard>
  )
}

export default function AskVerseComparison({
  passages,
  compareWords = true,
}: {
  passages: PassageTarget[]
  compareWords?: boolean
}) {
  const { t } = useTranslation()
  if (!passages.length) return null
  return (
    <Box className="mt-5 gap-2">
      <HStack className="items-center gap-2">
        <FeatherIcon name="book-open" size={14} color="grey" />
        <Text accessibilityRole="header" className="text-[13px] text-grey">
          {t('askStudy.relatedPassages')}
        </Text>
      </HStack>
      {Array.from({ length: Math.ceil(passages.length / 2) }, (_, row) => (
        <ComparisonGroup
          key={row}
          passages={passages.slice(row * 2, row * 2 + 2)}
          compareWords={compareWords}
        />
      ))}
    </Box>
  )
}
