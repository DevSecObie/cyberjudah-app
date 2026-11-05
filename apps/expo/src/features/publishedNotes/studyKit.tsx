// CyberJudah's own pages, built from Bible Strong's components: the Nave and Lexicon lists
// (FiltersHeader, SearchInput, letter sections, AlphabetList) and its study pages (Header, an
// icon tile with the kind of page, the title, then StudySection cards). Only the data is ours.
import React, { createContext, useContext, useMemo, useRef, useState } from 'react'
import { Pressable, ScrollView, type LayoutChangeEvent } from 'react-native'
import HorizontalControlScrollView from '~common/HorizontalControlScrollView'
import sectionListGetItemLayout from 'react-native-section-list-get-item-layout'
import { useQuery } from '@tanstack/react-query'
import AlphabetList from '~common/AlphabetList'
import Empty from '~common/Empty'
import FiltersHeader from '~common/FiltersHeader'
import Header from '~common/Header'
import Loading from '~common/Loading'
import SearchInput from '~common/SearchInput'
import ResourceIcon from '~common/icons/ResourceIcon'
import Border from '~common/ui/Border'
import Box, { HStack, TouchableBox, VStack } from '~common/ui/Box'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import IconTile from '~common/ui/IconTile'
import { ListSectionTitle } from '~common/ui/ListSection'
import PageContent from '~common/ui/PageContent'
import SectionList from '~common/ui/SectionList'
import { STUDY_COLUMN_MAX_WIDTH, StudyRowsCard, StudySection } from '~common/ui/StudySection'
import Text from '~common/ui/Text'
import { loadReferencePreview } from '~features/bibleReferencePreview/loadPreview'
import { parsePreviewOsis } from '~features/bibleReferencePreview/referenceTarget'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { cyberJudahSiteLinkToOsis } from '~helpers/cyberJudahSiteLinks'
import { titleFontStyle } from '~themes/styleValues'
import { useTheme } from '~themes/ThemeProvider'
import { resolveUniverseColors } from '~themes/universeColors'
import { IS_FORM_SHEET } from '~helpers/constants'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'

/** The Bible Strong page a CyberJudah page copies, which sets its icon and colour. */
export type StudyKind = 'nave' | 'dictionary' | 'strong' | 'commentary'

const ROW_HEIGHT = 60
const CHIP_ROW_HEIGHT = 80
const SECTION_HEADER_HEIGHT = 40

export type LetterListRow = {
  key: string
  label: string
  /** Small tags above the name, as the Lexicon list shows a word's language and number. */
  chips?: string[]
}

type Section = { title: string; data: LetterListRow[] }

const initialOf = (label: string) => {
  const first = label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/^(the|a|an)\s+/i, '')
    .trim()[0]
  return first && /[a-z]/i.test(first) ? first.toLowerCase() : '#'
}

const toSections = (rows: LetterListRow[]) => {
  const sections = new Map<string, LetterListRow[]>()
  for (const row of [...rows].sort((a, b) => a.label.localeCompare(b.label))) {
    const letter = initialOf(row.label)
    sections.set(letter, [...(sections.get(letter) ?? []), row])
  }
  return [...sections.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([title, data]): Section => ({ title, data }))
}

const chipClassName = 'rounded-full px-[6px] py-[2px] bg-border'

/** A row of the list, as Bible Strong's NaveItem, or its LexiqueItem when it carries chips. */
const LetterRow = ({
  row,
  hasSeparator,
  onPress,
}: {
  row: LetterListRow
  hasSeparator: boolean
  onPress: () => void
}) => {
  const theme = useTheme()
  const chips = row.chips?.filter(Boolean) ?? []
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
    >
      <Box
        className="px-[20px] items-start justify-center"
        style={{ height: chips.length ? CHIP_ROW_HEIGHT : ROW_HEIGHT }}
      >
        {chips.length > 0 && (
          <Box className="flex-row gap-[5px] mb-[3px]">
            {chips.map(chip => (
              <Box key={chip} className={chipClassName}>
                <Text className="text-[10px]" numberOfLines={1}>
                  {chip}
                </Text>
              </Box>
            ))}
          </Box>
        )}
        <Text
          className="text-[18px] text-default pr-[20px]"
          style={titleFontStyle(theme)}
          numberOfLines={1}
        >
          {row.label}
        </Text>
        {hasSeparator && <Border className="absolute bottom-0 left-[20px] right-0" />}
      </Box>
    </Pressable>
  )
}

/**
 * A list read letter by letter, as Bible Strong's Nave and Lexicon lists: a search field under the
 * title, the words of one letter, and the alphabet at the bottom. A search reads every letter.
 */
export const LetterListScreen = ({
  title,
  rows,
  isPending,
  isError,
  searchPlaceholder = 'Search',
  errorMessage = 'This list did not load. Check your connection.',
  emptyMessage = 'Nothing found.',
  matches,
  groups,
  filters = [],
  onReset,
  onOpen,
}: {
  /** Bible Strong's header filters, such as the kind and era of a case. */
  filters?: React.ComponentProps<typeof FiltersHeader>['filters']
  onReset?: () => void
  title: string
  rows: LetterListRow[] | undefined
  /** Sections in their own order (eras, parts) in place of letters; the alphabet then hides. */
  groups?: { title: string; data: LetterListRow[] }[]
  isPending: boolean
  isError?: boolean
  searchPlaceholder?: string
  errorMessage?: string
  emptyMessage?: string
  /** Whether a row answers a search, beyond its name. */
  matches?: (key: string, query: string) => boolean
  onOpen: (key: string) => void
}) => {
  const [letter, setLetter] = useState('a')
  const [search, setSearch] = useState('')
  const all = useMemo(() => groups ?? toSections(rows ?? []), [groups, rows])
  // A list with no entry under the chosen letter opens at its first letter instead.
  const current = all.some(section => section.title === letter) ? letter : (all[0]?.title ?? letter)
  const hasChips = all.some(section => section.data.some(row => row.chips?.some(Boolean)))
  const rowHeight = hasChips ? CHIP_ROW_HEIGHT : ROW_HEIGHT
  const sections = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q && groups) return all
    if (!q) {
      const own = all.filter(section => section.title === current)
      return own.length ? own : []
    }
    return all
      .map(section => ({
        ...section,
        data: section.data.filter(
          row => row.label.toLowerCase().includes(q) || !!matches?.(row.key, q)
        ),
      }))
      .filter(section => section.data.length)
  }, [all, current, search, matches, groups])
  const getItemLayout = useMemo(
    () =>
      sectionListGetItemLayout({
        getItemHeight: () => rowHeight,
        getSectionHeaderHeight: () => SECTION_HEADER_HEIGHT,
        getSeparatorHeight: () => 0,
        getSectionFooterHeight: () => 0,
      }) as (data: Section[], index: number) => { length: number; offset: number; index: number },
    [rowHeight]
  )

  return (
    <FormSheetScreen className="bg-canvas" reserveBottom={!search && !groups}>
      <Box className="overflow-hidden border-continuous flex-[1] bg-reverse">
        <FiltersHeader
          hasBackButton
          title={title}
          onReset={() => {
            setSearch('')
            onReset?.()
          }}
          filters={filters}
        >
          <Box className="overflow-hidden border-continuous pb-[10px] px-[20px]">
            <SearchInput
              placeholder={searchPlaceholder}
              onChangeText={setSearch}
              value={search}
              onDelete={() => setSearch('')}
            />
          </Box>
        </FiltersHeader>
        <Box className="overflow-hidden border-continuous flex-[1]">
          {isPending ? (
            <Loading />
          ) : sections.length ? (
            <SectionList<LetterListRow, Section>
              sections={sections}
              keyExtractor={row => row.key}
              renderItem={({ item, index, section }) => (
                <LetterRow
                  row={item}
                  hasSeparator={index < section.data.length - 1}
                  onPress={() => onOpen(item.key)}
                />
              )}
              renderSectionHeader={({ section }) => (
                <Box className="bg-reverse" style={{ height: SECTION_HEADER_HEIGHT }}>
                  <ListSectionTitle className="ml-[20px] mt-[16px] mb-[6px] leading-[18px]">
                    {section.title.toUpperCase()}
                  </ListSectionTitle>
                </Box>
              )}
              stickySectionHeadersEnabled
              removeClippedSubviews
              initialNumToRender={12}
              maxToRenderPerBatch={10}
              windowSize={5}
              getItemLayout={(data, index) => getItemLayout((data || []) as Section[], index)}
              contentContainerStyle={{ paddingBottom: 24 }}
            />
          ) : (
            <Empty
              icon={require('~assets/images/empty-state-icons/word.svg')}
              message={isError ? errorMessage : emptyMessage}
            />
          )}
        </Box>
        {!search && !groups && (
          <AlphabetList
            // Mounted again once the list loads, so the alphabet starts on its first letter.
            key={all[0]?.title ?? ''}
            color="quint"
            letter={current}
            setLetter={setLetter}
          />
        )}
      </Box>
    </FormSheetScreen>
  )
}

type JumpContext = { anchor: (id: string) => (event: LayoutChangeEvent) => void }
const Jumps = createContext<JumpContext>({ anchor: () => () => {} })

/** Where a section of a study page starts, so the chips at the top can scroll to it. */
export const useJumpAnchor = (id: string) => useContext(Jumps).anchor(id)

/** The section chips under a study page's title, as on Bible Strong's word study page. */
const JumpBar = ({
  jumps,
  onPress,
}: {
  jumps: { id: string; label: string }[]
  onPress: (id: string) => void
}) => (
  <Box className="overflow-hidden border-continuous mx-[-20px] py-[8px] bg-canvas z-[10]">
    <PageContent style={{ maxWidth: STUDY_COLUMN_MAX_WIDTH + 40 }}>
      <HorizontalControlScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
      >
        {jumps.map(jump => (
          <TouchableBox
            className="overflow-hidden border-continuous bg-surface rounded-full px-[12px] py-[6px]"
            key={jump.id}
            onPress={() => onPress(jump.id)}
            activeOpacity={0.7}
          >
            <Text className="text-[13px]">{jump.label}</Text>
          </TouchableBox>
        ))}
      </HorizontalControlScrollView>
    </PageContent>
  </Box>
)

/** The top of a study page: the kind of page beside its icon, then the title. */
export const StudyHeading = ({
  kind,
  kindLabel,
  title,
  subtitle,
}: {
  kind: StudyKind
  kindLabel: string
  title: string
  subtitle?: string
}) => {
  const theme = useTheme()
  const universe = resolveUniverseColors(theme.colors, kind)
  return (
    <VStack className="gap-[10px] pt-[2px] pb-[4px]">
      <HStack className="items-center gap-[10px]">
        <IconTile bg={universe.background}>
          <ResourceIcon kind={kind} size={18} color={universe.foreground} />
        </IconTile>
        <Text className="text-[15px] text-grey">{kindLabel}</Text>
      </HStack>
      <Text className="text-[34px] leading-[42px]" style={titleFontStyle(theme)}>
        {title}
      </Text>
      {!!subtitle && <Text className="text-[15px] text-grey">{subtitle}</Text>}
    </VStack>
  )
}

/**
 * A study page, as Bible Strong's Nave topic, dictionary entry and word study: the kind of page
 * beside its icon, the title, the section chips, then the page's StudySection cards.
 */
export const StudyPage = ({
  kind,
  kindLabel,
  headerTitle,
  title,
  subtitle,
  jumps,
  initialJump,
  isPending,
  isError,
  errorMessage = 'This page did not load. Check your connection.',
  children,
}: {
  /** The section the page opens at, such as the law a verse's tag names. */
  initialJump?: string
  kind: StudyKind
  kindLabel: string
  headerTitle: string
  title?: string
  subtitle?: string
  jumps?: { id: string; label: string }[]
  isPending: boolean
  isError?: boolean
  errorMessage?: string
  children?: React.ReactNode
}) => {
  const scrollRef = useRef<ScrollView>(null)
  const offsets = useRef<Record<string, number>>({})
  const jumped = useRef(false)
  const jumpContext = useMemo<JumpContext>(
    () => ({
      anchor: id => event => {
        const y = event.nativeEvent.layout.y
        offsets.current[id] = y
        if (id === initialJump && !jumped.current) {
          jumped.current = true
          setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, y - 54), animated: false }))
        }
      },
    }),
    [initialJump]
  )
  const shownJumps = jumps?.filter(Boolean) ?? []
  // As Bible Strong's Nave entry: on iPhone the page is the (explore) form sheet itself, which
  // opens part way up and pulls to full height; the back button shows once a page is stacked.
  const canGoBackInStack = useCanGoBackInStack()
  return (
    <FormSheetScreen className="bg-canvas" isFormSheet={IS_FORM_SHEET}>
      <Box className="overflow-hidden border-continuous flex-[1] bg-canvas">
        <Header hasBackButton={IS_FORM_SHEET ? canGoBackInStack : true} title={headerTitle} />
        {isPending ? (
          <Loading />
        ) : !title ? (
          <Empty
            icon={require('~assets/images/empty-state-icons/inbox.svg')}
            message={isError ? errorMessage : 'Nothing here yet.'}
          />
        ) : (
          <Jumps.Provider value={jumpContext}>
            <ScrollView
              ref={scrollRef}
              style={{ flex: 1 }}
              stickyHeaderIndices={shownJumps.length > 1 ? [1] : undefined}
              contentContainerStyle={{
                width: '100%',
                maxWidth: STUDY_COLUMN_MAX_WIDTH + 40,
                alignSelf: 'center',
                paddingHorizontal: 20,
                paddingBottom: 60,
              }}
            >
              <StudyHeading kind={kind} kindLabel={kindLabel} title={title} subtitle={subtitle} />
              {shownJumps.length > 1 ? (
                <JumpBar
                  jumps={shownJumps}
                  onPress={id => {
                    const y = offsets.current[id]
                    if (y != null)
                      scrollRef.current?.scrollTo({ y: Math.max(0, y - 54), animated: true })
                  }}
                />
              ) : (
                <Box />
              )}
              {children}
            </ScrollView>
          </Jumps.Provider>
        )}
      </Box>
    </FormSheetScreen>
  )
}

/** A section of a study page that the chips at the top can reach. */
export const JumpSection = ({
  id,
  ...props
}: Omit<React.ComponentProps<typeof StudySection>, 'onLayout'> & { id: string }) => (
  <StudySection {...props} onLayout={useJumpAnchor(id)} />
)

/** The KJV words of a scripture link (a cyberjudah.io Bible address), read as the verse preview reads them. */
export const useScriptureText = (url: string, enabled = true) => {
  const resources = useResourceAccess()
  const osis = cyberJudahSiteLinkToOsis(url.startsWith('/') ? `https://cyberjudah.io${url}` : url)
  const target = osis ? parsePreviewOsis(osis) : undefined
  return useQuery({
    queryKey: ['cyberjudah-scripture-text', osis],
    queryFn: async () =>
      target
        ? (await loadReferencePreview(target, 'KJV', resources.bibleContent))
            .map(verse => verse.Texte.replace(/<[^>]*>/gu, ''))
            .join(' ')
        : '',
    enabled: enabled && !!target,
    staleTime: Infinity,
  })
}

/** A scripture row that reads its own KJV words. */
export const LinkedScriptureRow = ({
  label,
  url,
  onPress,
  footer,
}: {
  label: string
  url: string
  onPress: () => void
  footer?: React.ReactNode
}) => {
  const text = useScriptureText(url)
  return <ScriptureRow label={label} text={text.data} onPress={onPress} footer={footer} />
}

/** A scripture in a card row: its reference in the link colour, the KJV words under it. */
export const ScriptureRow = ({
  label,
  text,
  onPress,
  footer,
}: {
  label: string
  text?: string
  onPress: () => void
  footer?: React.ReactNode
}) => (
  <VStack className="px-[16px] py-[12px] gap-[6px]">
    <TouchableBox accessibilityRole="link" onPress={onPress} activeOpacity={0.7}>
      <Text className="text-link text-[15px] font-bold">{label}</Text>
      {!!text && <Text className="text-[16px] leading-[24px] mt-[4px]">{text}</Text>}
    </TouchableBox>
    {footer}
  </VStack>
)

/** Tappable names in a row of rounded chips, as Bible Strong's dictionary sources. */
export const ChipRow = ({
  chips,
  onPress,
}: {
  chips: { key: string; label: string }[]
  onPress: (key: string) => void
}) => (
  <Box className="flex-row flex-wrap gap-[8px]">
    {chips.map(chip => (
      <TouchableBox
        key={chip.key}
        accessibilityRole="link"
        onPress={() => onPress(chip.key)}
        className="overflow-hidden border-continuous rounded-full px-[12px] py-[6px] bg-surface"
      >
        <Text className="text-[14px]">{chip.label}</Text>
      </TouchableBox>
    ))}
  </Box>
)

export { StudyRowsCard }
