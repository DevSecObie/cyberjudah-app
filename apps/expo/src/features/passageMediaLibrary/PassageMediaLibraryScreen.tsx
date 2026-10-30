import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { pageContentStyle } from '~common/ui/PageContent'
import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SectionList, useWindowDimensions } from 'react-native'
import Header from '~common/Header'
import FiltersHeader, { type FiltersHeaderItem } from '~common/FiltersHeader'
import PanelSearch from '~common/ContextualPanel/PanelSearch'
import { Image } from 'expo-image'
import { TouchableBox } from '~common/ui/Box'
import Box, { SafeAreaBox, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import {
  getPassageMediaLibrary,
  type ResolvedPassageMediaLibraryItem,
} from '~features/bible/passageMedia'
import useLanguage from '~helpers/useLanguage'
import useDebounce from '~helpers/useDebounce'
import { useQuery } from '@tanstack/react-query'
import { usesCyberJudahEditorial } from '~helpers/editorialProfile'
import PassageMediaLibraryCard from './PassageMediaLibraryCard'
import { classesForHits, searchInsideClasses, searchKindsFor } from './classSearch'
import {
  CLASS_COLLECTIONS,
  filterClassLibrary,
  loadClassLibrary,
  readCachedClassLibrary,
  type CyberJudahClass,
} from './cyberJudahClasses'
// Editorial order of the 19 episodes published in BibleProject's
// "How to Read the Bible" collection.
const HOW_TO_READ_THE_BIBLE_WORK_IDS = [
  'associated-resource-ak06MSETeo4',
  'associated-resource-7_CGP-12AE0',
  'associated-resource-ebI_4ZxcAMk',
  'associated-resource-VhmlJBUIoLk',
  'associated-resource-FqXKc81z7Oc',
  'associated-resource-0EQDGax19xk',
  'associated-resource-7FuT8WtoAK0',
  'associated-resource-j5qdaWO9wp8',
  'associated-resource-IQhUpoYAnKQ',
  'associated-resource-L9W5afjndtU',
  'associated-resource-dpny22k_7uk',
  'associated-resource-QmrpB52gWwM',
  'associated-resource-Sew1kBIe-W0',
  'associated-resource-WJgt1vRkPbI',
  'associated-resource-L0-8nUbfW5w',
  'associated-resource-IT3LVWWuDDo',
  'associated-resource-GZuceW7eh5M',
  'associated-resource-ZPZ2uABVMKA',
  'associated-resource-Tn09RdxfqbM',
] as const

const HOW_TO_READ_THE_BIBLE_ORDER = new Map<string, number>(
  HOW_TO_READ_THE_BIBLE_WORK_IDS.map((workId, index) => [workId, index])
)

type LibrarySection = {
  title: string
  data: ResolvedPassageMediaLibraryItem[]
  /** Shown with "See all" when the section lists only its newest classes. */
  more?: number
}
// Each collection lists its newest classes; "See all" opens the whole collection.
const SECTION_PAGE = 12

type ClassFilters = {
  query: string
  series?: string
  teacher?: string
  year?: string
  collection?: string
}

const getHowToReadTheBibleEpisodes = (items: ResolvedPassageMediaLibraryItem[]) =>
  items
    .filter(item => HOW_TO_READ_THE_BIBLE_ORDER.has(item.workId))
    .sort(
      (left, right) =>
        (HOW_TO_READ_THE_BIBLE_ORDER.get(left.workId) ?? Number.MAX_SAFE_INTEGER) -
        (HOW_TO_READ_THE_BIBLE_ORDER.get(right.workId) ?? Number.MAX_SAFE_INTEGER)
    )

// CyberJudah's classes under their collections, as in the Telegram app, or one list when filtered.
// The featured latest class is left out of its section below, so it is listed once.
const getClassSections = (
  classes: CyberJudahClass[],
  filters: ClassFilters,
  featured?: CyberJudahClass
): LibrarySection[] => {
  const rows = filterClassLibrary(classes, filters)
  const filtered = !!(filters.query.trim() || filters.teacher || filters.year || filters.collection)
  if (filtered || filters.series) {
    return rows.length
      ? [{ title: filters.collection || filters.series || 'Results', data: rows }]
      : []
  }
  return CLASS_COLLECTIONS.map(title => {
    const data = rows.filter(item => item.series === title && item !== featured)
    return { title, data: data.slice(0, SECTION_PAGE), more: data.length }
  }).filter(section => section.data.length)
}

const unique = (values: string[]) => [...new Set(values.filter(Boolean))]

const PassageMediaLibraryScreen = () => {
  const stylingTheme = useStylingTheme()

  const { t } = useTranslation()
  const router = useRouter()
  const language = useLanguage()
  const { width: windowWidth } = useWindowDimensions()
  const cyberJudah = usesCyberJudahEditorial()
  // CyberJudah lists every published class, read live and kept for offline opens.
  const classLibrary = useQuery({
    queryKey: ['cyberjudah-class-library'],
    queryFn: () => loadClassLibrary(),
    initialData: () => readCachedClassLibrary() ?? undefined,
    initialDataUpdatedAt: 0,
    enabled: cyberJudah,
    staleTime: 5 * 60 * 1000,
    networkMode: 'always',
    retry: 1,
  })
  const classes = cyberJudah ? (classLibrary.data ?? []) : []
  const library = classes.length ? classes : getPassageMediaLibrary({ language })
  const [filters, setFilters] = useState<ClassFilters>({ query: '' })
  const setFilter = (next: Partial<ClassFilters>) =>
    setFilters(current => ({ ...current, ...next }))
  const unfiltered =
    !filters.query.trim() &&
    !filters.series &&
    !filters.teacher &&
    !filters.year &&
    !filters.collection
  const featured = unfiltered ? classes.find(item => item.series === 'Sabbath classes') : undefined
  const seriesSections = useMemo(
    () => getClassSections(classes, filters, featured),
    [classes, filters, featured]
  )
  // Past the titles: the classes whose notes say the words, from the site's search of every note.
  const searchText = useDebounce(filters.query.trim(), 350)
  const insideSearch = useQuery({
    queryKey: ['cyberjudah-class-search', searchText, filters.series ?? ''],
    queryFn: () => searchInsideClasses(searchText, searchKindsFor(filters.series)),
    enabled: cyberJudah && searchText.length >= 3,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
  const insideSection = useMemo((): LibrarySection | undefined => {
    if (!insideSearch.data?.length || searchText !== filters.query.trim()) return undefined
    const listed = new Set(
      seriesSections.flatMap(section =>
        section.data.map(item => (item as CyberJudahClass).notesPath)
      )
    )
    const rows = filterClassLibrary(classesForHits(insideSearch.data, classes, listed), {
      ...filters,
      query: '',
    })
    return rows.length ? { title: 'Said in the classes', data: rows } : undefined
  }, [insideSearch.data, searchText, filters, seriesSections, classes])
  const inSeries = useMemo(
    () => (filters.series ? classes.filter(item => item.series === filters.series) : classes),
    [classes, filters.series]
  )
  const choices = (
    current: string | undefined,
    values: string[],
    every: string,
    key: 'series' | 'teacher' | 'year' | 'collection'
  ) => [
    { key: '', label: every, selected: !current, onSelect: () => setFilter({ [key]: undefined }) },
    ...values.map(value => ({
      key: value,
      label: value,
      selected: value === current,
      onSelect: () => setFilter({ [key]: value }),
    })),
  ]
  const classFilters: FiltersHeaderItem[] = [
    {
      key: 'search',
      icon: 'search',
      label: t('passageMediaLibrary.search'),
      value: filters.query.trim() || undefined,
      active: !!filters.query.trim(),
      onPress: () => {},
      content: () => <PanelSearch value={filters.query} onChange={query => setFilter({ query })} />,
    },
    {
      key: 'series',
      icon: 'layers',
      label: t('passageMediaLibrary.collection'),
      value: filters.series,
      active: !!filters.series,
      onPress: () => {},
      options: choices(
        filters.series,
        CLASS_COLLECTIONS.filter(title => classes.some(item => item.series === title)),
        t('passageMediaLibrary.everyCollection'),
        'series'
      ),
    },
    {
      key: 'teacher',
      icon: 'user',
      label: t('passageMediaLibrary.teacher'),
      value: filters.teacher,
      active: !!filters.teacher,
      searchable: true,
      onPress: () => {},
      options: choices(
        filters.teacher,
        unique(inSeries.map(item => item.teacher)).sort(),
        t('passageMediaLibrary.everyTeacher'),
        'teacher'
      ),
    },
    {
      key: 'year',
      icon: 'clock',
      label: t('passageMediaLibrary.year'),
      value: filters.year,
      active: !!filters.year,
      onPress: () => {},
      options: choices(
        filters.year,
        unique(inSeries.map(item => item.year))
          .sort()
          .reverse(),
        t('passageMediaLibrary.everyYear'),
        'year'
      ),
    },
    {
      key: 'collection',
      icon: 'list',
      label: t('passageMediaLibrary.show'),
      value: filters.collection,
      active: !!filters.collection,
      searchable: true,
      onPress: () => {},
      options: choices(
        filters.collection,
        unique(inSeries.map(item => item.collection)).sort(),
        t('passageMediaLibrary.everyShow'),
        'collection'
      ),
    },
  ]
  const episodes = getHowToReadTheBibleEpisodes(library)
  const contentWidth = Math.min(windowWidth, 760)
  const thumbnailWidth = Math.min(176, Math.max(128, (contentWidth - 40) * 0.38))
  const sections: LibrarySection[] = insideSection
    ? [...seriesSections, insideSection]
    : seriesSections.length
      ? seriesSections
      : episodes.length
        ? [
            {
              title: t('passageMediaLibrary.categories.how-to-read'),
              data: episodes,
            },
          ]
        : []

  const playVideo = (item: ResolvedPassageMediaLibraryItem) => {
    router.push({
      pathname: '/(explore)/passage-media-player',
      params: { workId: item.workId },
    })
  }

  return (
    <SafeAreaBox className="overflow-hidden border-continuous bg-reverse">
      {classes.length ? (
        <FiltersHeader
          hasBackButton
          title={t('passageMediaLibrary.title')}
          filters={classFilters}
          onReset={() => setFilters({ query: '' })}
        />
      ) : (
        <Header hasBackButton background title={t('passageMediaLibrary.title')} />
      )}
      <SectionList
        sections={sections}
        keyExtractor={item => item.editionId}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          pageContentStyle,
          {
            width: '100%',
            maxWidth: contentWidth,
            alignSelf: 'center',
            paddingHorizontal: 20,
            paddingTop: 24,
            paddingBottom: 48,
          },
        ]}
        ListHeaderComponent={
          <VStack className="overflow-hidden border-continuous mb-[22px] gap-[5px]">
            <Text
              className="text-[25px] leading-[31px]"
              style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
            >
              {t('passageMediaLibrary.heading')}
            </Text>
            <Text
              className="text-grey text-[15px] leading-[21px]"
              style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.text) }}
            >
              {t(
                seriesSections.length
                  ? 'passageMediaLibrary.cyberJudahSubtitle'
                  : 'passageMediaLibrary.subtitle'
              )}
            </Text>
            {!!featured && (
              <TouchableBox
                className="mt-[18px] gap-[10px]"
                accessibilityRole="button"
                accessibilityLabel={featured.title}
                activeOpacity={0.85}
                onPress={() => playVideo(featured)}
              >
                <Image
                  source={{ uri: featured.thumbnailUrl.replace('hqdefault', 'maxresdefault') }}
                  placeholder={{ blurhash: featured.blurHash }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={180}
                  style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 14 }}
                />
                <Text className="font-bold text-primary text-[12px]">
                  {t('passageMediaLibrary.latest')} · {featured.subtitle}
                </Text>
                <Text
                  className="text-[20px] leading-[25px]"
                  style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
                >
                  {featured.title}
                </Text>
              </TouchableBox>
            )}
          </VStack>
        }
        renderSectionHeader={({ section }) => (
          <Box className="overflow-hidden border-continuous bg-reverse pt-[30px] pb-[20px] flex-row items-center">
            <Text
              className="text-[19px] flex-[1]"
              style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
            >
              {section.title}
            </Text>
            {!!section.more && section.more > section.data.length && (
              <TouchableBox
                accessibilityRole="button"
                className="py-[4px] pl-[12px]"
                onPress={() => setFilter({ series: section.title })}
              >
                <Text className="text-primary text-[14px]">
                  {t('passageMediaLibrary.seeAll', { count: section.more })}
                </Text>
              </TouchableBox>
            )}
          </Box>
        )}
        renderItem={({ item, index }) => {
          const snippet = (item as { snippet?: string }).snippet
          return (
            <VStack>
              <PassageMediaLibraryCard
                item={item}
                episodeNumber={index + 1}
                thumbnailWidth={thumbnailWidth}
                onPress={() => playVideo(item)}
              />
              {!!snippet && (
                <Text
                  className="text-grey text-[14px] leading-[20px] mb-[18px] -mt-[6px]"
                  numberOfLines={3}
                >
                  {snippet}
                </Text>
              )}
            </VStack>
          )
        }}
        ListEmptyComponent={
          <Box className="overflow-hidden border-continuous py-[60px] items-center justify-center">
            <Text className="text-grey text-center">
              {insideSearch.isFetching
                ? 'Searching every class…'
                : insideSearch.isError
                  ? 'The class search is not answering. Please try again.'
                  : t('passageMediaLibrary.empty')}
            </Text>
          </Box>
        }
      />
    </SafeAreaBox>
  )
}

export default PassageMediaLibraryScreen
