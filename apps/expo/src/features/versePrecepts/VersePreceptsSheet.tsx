import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import React, { useState } from 'react'
import { Linking, Platform } from 'react-native'
import Sheet from '~common/ContextualPanel/ContextualSheet'
import { SheetHeader, SheetScrollView, type SheetRef } from '~common/sheet'
import Box, { TouchableBox, VStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import books from '~assets/cyberjudah/books.json'
import { loadVerseText } from '~features/lexique/cyberJudahPerson'
import { readCachedClassLibrary } from '~features/passageMediaLibrary/cyberJudahClasses'
import { cyberJudahSiteLinkToOsis } from '~helpers/cyberJudahSiteLinks'
import { resolveFontFamily } from '~themes/styleValues'
import { useTheme } from '~themes/ThemeProvider'
import { preceptsForVerse, type VersePrecept } from './versePrecepts'

const SITE = 'https://cyberjudah.io'

const formatDate = (date?: string) => {
  if (!date) return ''
  const parsed = new Date(`${date}T12:00:00Z`)
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const useVerseText = (url: string) =>
  useQuery({
    queryKey: ['cyberjudah-verse-text', url],
    queryFn: () => loadVerseText(url),
    enabled: !!url,
    staleTime: Infinity,
  }).data ?? ''

/** One precept as the Telegram app's card: the scripture and its text, the breakdown, the class. */
const PreceptCard = ({
  precept,
  onOpenReference,
  onOpenClass,
}: {
  precept: VersePrecept
  onOpenReference: (url: string) => void
  onOpenClass: (notesPath: string) => void
}) => {
  const theme = useTheme()
  const [expanded, setExpanded] = useState(false)
  const range = /^(\d+)-(\d+)$/.exec(precept.ref.verses ?? '')
  const verseText = useVerseText(
    range ? precept.ref.url.replace(/#v\d+$/, `#v${range[1]}-${range[2]}`) : precept.ref.url
  )
  const paragraphs = (precept.why || precept.point || '')
    .split(/\n{2,}/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean)
  const shown = expanded ? paragraphs : paragraphs.slice(0, 1)
  return (
    <VStack className="rounded-[18px] bg-light-grey p-[16px] gap-[10px]">
      <TouchableBox
        accessibilityRole="link"
        onPress={() => onOpenReference(precept.ref.url)}
        className="flex-row items-center gap-[10px]"
      >
        <Box className="rounded-[10px] bg-reverse px-[10px] py-[3px]">
          <Text className="text-[13px] font-bold text-grey">Precept</Text>
        </Box>
        <Text className="flex-[1] text-primary text-[19px] font-bold">{precept.ref.label}</Text>
        <FeatherIcon name="chevron-right" size={18} color="grey" />
      </TouchableBox>
      {!!verseText && (
        <Text
          className="text-grey text-[17px] leading-[25px]"
          style={{ fontFamily: resolveFontFamily(theme.fontFamily.title), fontStyle: 'italic' }}
        >
          {verseText}
        </Text>
      )}
      {shown.map((paragraph, index) => (
        <Text key={index} className="text-[16px] leading-[24px]">
          {paragraph}
        </Text>
      ))}
      {paragraphs.length > 1 && (
        <TouchableBox accessibilityRole="button" onPress={() => setExpanded(!expanded)}>
          <Text className="text-[16px]">{expanded ? 'Show less' : 'Read more'}</Text>
        </TouchableBox>
      )}
      <TouchableBox accessibilityRole="link" onPress={() => onOpenClass(precept.note.url)}>
        <Text className="text-[14px] leading-[20px]">
          {[precept.note.label, formatDate(precept.note.date), precept.ts]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </TouchableBox>
    </VStack>
  )
}

/**
 * A verse's precepts in the "i" note's sheet, as the Telegram app shows them: the verse in full at
 * the top, then a card for each precept. It drags between half and full height.
 */
const VersePreceptsSheet = ({
  sheetRef,
  bookNumber,
  bookName,
  chapter,
  verse,
  precepts,
  onReferencePress,
}: {
  sheetRef: React.RefObject<SheetRef | null>
  bookNumber: number
  bookName: string
  chapter: number
  verse: number | null
  precepts: VersePrecept[]
  onReferencePress: (osis: string) => void
}) => {
  const theme = useTheme()
  const router = useRouter()
  const rows = verse ? preceptsForVerse(precepts, verse) : []
  const kjvBook = books.find(book => book.id === bookNumber)
  const slug = kjvBook?.slug
  const verseText = useVerseText(slug && verse ? `/bible/${slug}/${chapter}#v${verse}` : '')
  const openReference = (url: string) => {
    const osis = cyberJudahSiteLinkToOsis(`${SITE}${url}`)
    if (!osis) return
    if (Platform.OS === 'web') sheetRef.current?.dismiss()
    onReferencePress(osis)
  }
  const openClass = (notesPath: string) => {
    sheetRef.current?.dismiss()
    const item = readCachedClassLibrary()?.find(entry => entry.notesPath === notesPath)
    if (item)
      router.push({ pathname: '/(explore)/passage-media-player', params: { workId: item.workId } })
    else void Linking.openURL(`${SITE}${notesPath}`)
  }

  return (
    <Sheet
      ref={sheetRef}
      panelWidth={440}
      snapPoints={[0.5, 1]}
      header={
        <SheetHeader
          title={`${kjvBook?.name ?? bookName} ${chapter}:${verse ?? ''}`}
          subTitle="Precepts"
        />
      }
    >
      <SheetScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }}>
        {!!verseText && (
          <Text
            className="text-[19px] leading-[29px] px-[4px] pb-[4px]"
            style={{ fontFamily: resolveFontFamily(theme.fontFamily.title) }}
            selectable
          >
            {verseText}
          </Text>
        )}
        {rows.map((precept, index) => (
          <PreceptCard
            key={`${precept.ref.label}:${precept.note.url}:${index}`}
            precept={precept}
            onOpenReference={openReference}
            onOpenClass={openClass}
          />
        ))}
      </SheetScrollView>
    </Sheet>
  )
}

export default VersePreceptsSheet
