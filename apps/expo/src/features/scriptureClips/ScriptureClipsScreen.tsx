import { useQuery } from '@tanstack/react-query'
import Color from 'color'
import { useRouter } from 'expo-router'
import { useAtomValue } from 'jotai/react'
import { atom } from 'jotai/vanilla'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewToken,
} from 'react-native'
import { SystemBars } from 'react-native-edge-to-edge'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSelector } from 'react-redux'
import { Sheet, SheetView, type SheetRef } from '~common/sheet'
import { FeatherIcon } from '~common/ui/Icon'
import ThemedText from '~common/ui/Text'
import books from '~assets/cyberjudah/books.json'
import { useBookAndVersionSelector } from '~features/bible/BookSelectorSheet/BookSelectorSheetProvider'
import ActionItem from '~features/bible/SelectedVersesModal/components/ActionItem'
import ActionsLayout from '~features/bible/SelectedVersesModal/components/ActionsLayout'
import { bookNameOf, loadChapterClasses } from '~features/bible/classMoments'
import { formatPassageMediaDuration, getPassageMediaEmbedUrl } from '~features/bible/passageMedia'
import ClassVideoFrame, {
  type ClassVideoFrameHandle,
} from '~features/passageMediaLibrary/ClassVideoFrame'
import { useOpenSiteLink } from '~features/publishedNotes/siteLinks'
import { getBook } from '~helpers/bibleBookCatalog'
import loadBibleChapter from '~helpers/loadBibleChapter'
import type { RootState } from '~redux/modules/reducer'
import { getDefaultBibleTab, useBibleTabActions } from '~state/tabs'
import { useDefaultBibleVersion } from '~state/useDefaultBibleVersion'
import { useTheme } from '~themes/ThemeProvider'
import { resolveFontFamily } from '~themes/styleValues'
import AnimatedCaption from './AnimatedCaption'
import { clipLength, clipReference, clipsForChapter, type ScriptureClip } from './scriptureClips'

const GOLD = '#E0B44A'

type Loaded = { video: string; start: number }

const slugOf = (bookNumber: number) => books.find(book => book.id === bookNumber)?.slug ?? ''
const plain = (text: string) =>
  text
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/** The chapter after this one, into the next book after the last chapter; none after the last. */
const nextPlace = (bookNumber: number, chapter: number) => {
  const book = getBook(bookNumber)
  if (book && chapter < book.Chapitres) return { book: bookNumber, chapter: chapter + 1 }
  return getBook(bookNumber + 1) ? { book: bookNumber + 1, chapter: 1 } : null
}

/**
 * Scripture Clips (preview): a chapter as a Shorts style feed of the classes the Bible reader
 * shows under its verses, in the reader's order. The class video plays in place where the class
 * takes the verse up, and the feed moves on when the class does, into the next chapter at the
 * end. The book and chapter picker is the reader's. This is a CyberJudah component, not one of
 * Bible Strong's.
 */
const ScriptureClipsScreen = () => {
  const router = useRouter()
  const { open, openMoment } = useOpenSiteLink()
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const bibleFont = useSelector((state: RootState) => state.user.fontFamily)
  const version = useDefaultBibleVersion()
  const { openBookSelector } = useBookAndVersionSelector()
  // The reader's book and chapter picker works on a Bible tab; this page keeps its own.
  const [placeAtom] = useState(() => {
    const tab = getDefaultBibleTab()
    const genesis = getBook(1)!
    tab.data.selectedBook = genesis
    tab.data.selectedChapter = 1
    tab.data.selectedVerse = 1
    tab.data.temp = { selectedBook: genesis, selectedChapter: 1, selectedVerse: 1 }
    return atom(tab)
  })
  const placeTab = useAtomValue(placeAtom)
  const placeActions = useBibleTabActions(placeAtom)
  const bookNumber = placeTab.data.selectedBook.Numero
  const chapter = placeTab.data.selectedChapter
  const bookName = bookNameOf(bookNumber) || placeTab.data.selectedBook.Nom
  const slug = slugOf(bookNumber)

  const classesQuery = useQuery({
    queryKey: ['scripture-clips-classes', bookNumber, chapter],
    queryFn: () => loadChapterClasses(bookNumber, chapter),
    networkMode: 'always',
    retry: 1,
  })
  const textQuery = useQuery({
    queryKey: ['scripture-clips-text', version, bookNumber, chapter],
    queryFn: async () => {
      const result = await loadBibleChapter(bookNumber, chapter, version)
      if (!result.success) return []
      return result.data.verses.map(verse => ({
        v: Number(verse.Verset),
        text: plain(String(verse.Texte ?? '')),
      }))
    },
    networkMode: 'always',
  })
  const loading = classesQuery.isLoading || textQuery.isLoading
  const clips = useMemo(
    () => clipsForChapter(classesQuery.data, chapter, textQuery.data ?? []),
    [classesQuery.data, chapter, textQuery.data]
  )
  const next = nextPlace(bookNumber, chapter)
  const goTo = useCallback(
    (place: { book: number; chapter: number }) => {
      const book = getBook(place.book)
      if (!book) return
      placeActions.setSelectedBook(book)
      placeActions.setSelectedChapter(place.chapter)
      placeActions.setSelectedVerse(1)
    },
    [placeActions]
  )
  const pickChapter = () => openBookSelector({ actions: placeActions, data: placeTab.data })
  const list = useRef<FlatList<ScriptureClip>>(null)
  const frame = useRef<ClassVideoFrameHandle>(null)
  const sheet = useRef<SheetRef>(null)
  const theme = useTheme()
  const sheetTint = useMemo(
    () => Color(theme.colors.reverse).alpha(0.9).rgb().string(),
    [theme.colors.reverse]
  )
  const [index, setIndex] = useState(0)
  const [sheetClip, setSheetClip] = useState<ScriptureClip | null>(null)
  const firstWithVideo = clips.find(clip => clip.video && clip.start !== undefined)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  // The video's clock: its last reported second, when that was, and whether it plays.
  const clockRef = useRef({ t: firstWithVideo?.start ?? 0, at: Date.now(), playing: false })
  // The feed moved on by itself, so the video already sits at the next verse.
  const advancing = useRef(false)
  const indexRef = useRef(0)

  const videoTop = insets.top + Math.round(height * 0.14)
  const videoHeight = Math.round((width * 9) / 16)
  const clip = clips[index]

  useEffect(() => {
    const entry = SystemBars.pushStackEntry({ style: 'light' })
    return () => SystemBars.popStackEntry(entry)
  }, [])

  const now = useCallback(() => {
    const clock = clockRef.current
    return clock.t + (clock.playing ? (Date.now() - clock.at) / 1000 : 0)
  }, [])

  const getElapsed = useCallback(() => now() - (clips[indexRef.current]?.start ?? 0), [clips, now])

  // Another chapter: back to its first clip, or no video when no class has taken it up.
  useEffect(() => {
    advancing.current = false
    setIndex(0)
    list.current?.scrollToOffset({ offset: 0, animated: false })
    if (!clips.length) setLoaded(null)
  }, [clips])

  // A verse came on screen: play it from its second, unless the video is already there.
  const shownClips = useRef(clips)
  useEffect(() => {
    // A new chapter waits for the feed to be back at its first clip.
    if (shownClips.current !== clips) {
      shownClips.current = clips
      if (index !== 0) return
    }
    indexRef.current = index
    const current = clips[index]
    if (!current?.video || current.start === undefined) return
    if (!loaded || loaded.video !== current.video) {
      clockRef.current = { t: current.start, at: Date.now(), playing: false }
      setLoaded({ video: current.video, start: current.start })
    } else if (advancing.current) {
      advancing.current = false
    } else {
      clockRef.current = { t: current.start, at: Date.now(), playing: clockRef.current.playing }
      frame.current?.command({ func: 'seekTo', args: [current.start, true] })
      frame.current?.command({ func: 'playVideo' })
    }
    // `loaded` is read, not followed: loading a video must not seek it again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, clips])

  const advance = useCallback(() => {
    const following = indexRef.current + 1
    if (following >= clips.length) {
      // The chapter is done: on to the next one.
      if (next) goTo(next)
      return
    }
    advancing.current = clips[following].video === clips[indexRef.current].video
    list.current?.scrollToIndex({ index: following, animated: true })
  }, [clips, goTo, next])

  const onTime = useCallback(
    (seconds: number) => {
      clockRef.current = { ...clockRef.current, t: seconds, at: Date.now() }
      const current = clips[indexRef.current]
      if (current?.start === undefined) return
      if (seconds >= current.start + clipLength(current) - 0.3) advance()
    },
    [advance, clips]
  )

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems.find(item => item.isViewable)
    if (first?.index != null) setIndex(first.index)
  }).current

  const openSheet = (item: ScriptureClip) => {
    setSheetClip(item)
    sheet.current?.present()
  }

  const chapterPath = (item: ScriptureClip) => `/bible/${slug}/${item.c}`
  const openClass = (item: ScriptureClip) => {
    if (item.notes) open(item.notes)
    else if (item.video) openMoment({ video: item.video, t: item.start })
  }

  const scriptureFont = useMemo(() => ({ fontFamily: resolveFontFamily(bibleFont) }), [bibleFont])

  const renderItem = ({ item, index: at }: { item: ScriptureClip; index: number }) => {
    const length = clipLength(item)
    const by = item.teacher || item.series || ''
    return (
      <View style={{ width, height, backgroundColor: '#000' }}>
        <View style={{ height: videoTop + videoHeight + 18 }} />
        {at === index && <AnimatedCaption captions={item.captions} getElapsed={getElapsed} />}
        <View style={[styles.rail, { bottom: insets.bottom + 120 }]}>
          <RailButton icon="book-open" label="Chapter" onPress={() => open(chapterPath(item))} />
          <RailButton
            icon="file-text"
            label="Study"
            onPress={() => open(`/study/${slug}/${item.c}`)}
          />
          <RailButton icon="play-circle" label="Class" onPress={() => openClass(item)} />
        </View>
        <View style={[styles.meta, { bottom: insets.bottom + 26 }]}>
          {!!by && (
            <View style={styles.who}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {by.replace(/^(Bishop|Deacon|Captain)\s+/, '')[0]}
                </Text>
              </View>
              <Text style={styles.whoName} numberOfLines={1}>
                {by}
              </Text>
            </View>
          )}
          <Text style={styles.ref}>
            {bookName} {clipReference(item)}
            {item.start !== undefined && (
              <Text style={styles.refTime}>
                {'  '}
                {formatPassageMediaDuration(item.start)} · {formatPassageMediaDuration(length)}
              </Text>
            )}
          </Text>
          <Text style={[styles.verse, scriptureFont]} numberOfLines={3}>
            {item.text}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Opens the whole verse and the class"
            onPress={() => openSheet(item)}
            hitSlop={8}
          >
            <Text style={styles.more}>more</Text>
          </Pressable>
          {!!item.title && (
            <Text style={styles.classTitle} numberOfLines={1}>
              {item.title}
            </Text>
          )}
        </View>
        {at === index && length > 0 && (
          <ClipProgress length={length} getElapsed={getElapsed} bottom={insets.bottom + 8} />
        )}
      </View>
    )
  }

  return (
    <View style={styles.screen}>
      <FlatList
        ref={list}
        data={clips}
        keyExtractor={item => `${bookNumber}:${item.c}:${item.v}`}
        renderItem={renderItem}
        extraData={index}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        getItemLayout={(_, at) => ({ length: height, offset: height * at, index: at })}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        onScrollToIndexFailed={() => {}}
        windowSize={3}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        ListEmptyComponent={
          <View style={[styles.empty, { width, height }]}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.emptyText}>
                  {classesQuery.isError
                    ? 'The classes could not be loaded. Check your connection.'
                    : `No class has taken up ${bookName} ${chapter} yet.`}
                </Text>
                {!!next && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => goTo(next)}
                    style={styles.emptyButton}
                  >
                    <Text style={styles.emptyButtonText}>
                      {bookNameOf(next.book)} {next.chapter}
                    </Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        }
      />
      {loaded && (
        <View style={[styles.player, { top: videoTop, height: videoHeight }]}>
          <ClassVideoFrame
            key={`${loaded.video}:${loaded.start}`}
            ref={frame}
            uri={getPassageMediaEmbedUrl(loaded.video, loaded.start)}
            onTime={onTime}
            onState={state => {
              clockRef.current = { ...clockRef.current, at: Date.now(), playing: state === 1 }
            }}
          />
        </View>
      )}
      <View style={[styles.head, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          hitSlop={10}
        >
          <FeatherIcon name="chevron-left" size={28} color="white" />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose a book and chapter"
          onPress={pickChapter}
          hitSlop={8}
          style={styles.headPicker}
        >
          <Text style={styles.headTitle} numberOfLines={1}>
            {bookName} {chapter}
          </Text>
          <FeatherIcon name="chevron-down" size={18} color="white" />
        </Pressable>
        <View style={{ flex: 1 }} />
        {!!clip && <Text style={styles.headRef}>{clipReference(clip)}</Text>}
      </View>
      {/* The verse panel's glass sits over the Bible page, so it takes the page's colour. This page
          is black video, so the glass is tinted with the reader's colour to look the same. */}
      <Sheet ref={sheet} backdrop={false} backgroundColor={sheetTint}>
        {sheetClip && (
          <SheetView style={{ flex: 0, paddingTop: 10 }}>
            <View style={styles.sheetBody}>
              <ThemedText style={styles.sheetTitle}>
                {bookName} {clipReference(sheetClip)}
              </ThemedText>
              <ThemedText style={[styles.sheetVerse, scriptureFont]}>
                {(sheetClip.verses ?? [{ v: sheetClip.v, text: sheetClip.text }]).map(
                  ({ v, text }) => (
                    <ThemedText key={v}>
                      <ThemedText style={styles.verseNumber}>{v} </ThemedText>
                      {text}{' '}
                    </ThemedText>
                  )
                )}
              </ThemedText>
              {!!sheetClip.video && (
                <Pressable
                  accessibilityRole="link"
                  onPress={() => sheet.current?.dismissThen(() => openClass(sheetClip))}
                  style={[styles.classRow, { backgroundColor: theme.colors.lightGrey }]}
                >
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.classRowTitle} numberOfLines={2}>
                      {sheetClip.title}
                    </ThemedText>
                    <ThemedText style={styles.classRowMeta}>
                      {[sheetClip.teacher, sheetClip.date].filter(Boolean).join(' · ')}
                    </ThemedText>
                  </View>
                  {sheetClip.start !== undefined && (
                    <View style={[styles.pill, { backgroundColor: theme.colors.reverse }]}>
                      <ThemedText style={[styles.pillText, { color: theme.colors.primary }]}>
                        ▶ {formatPassageMediaDuration(sheetClip.start)}
                      </ThemedText>
                    </View>
                  )}
                </Pressable>
              )}
            </View>
            <ActionsLayout width={width}>
              <ActionItem
                name="book-open"
                label="Chapter"
                onPress={() => sheet.current?.dismissThen(() => open(chapterPath(sheetClip)))}
              />
              <ActionItem
                name="file-text"
                label="Study note"
                onPress={() =>
                  sheet.current?.dismissThen(() => open(`/study/${slug}/${sheetClip.c}`))
                }
              />
              <ActionItem
                name="play-circle"
                label="Class"
                onPress={() => sheet.current?.dismissThen(() => openClass(sheetClip))}
              />
              <ActionItem
                name="share-2"
                label="Share"
                onPress={() =>
                  Share.share({
                    message: `${bookName} ${clipReference(sheetClip)} ${sheetClip.text}`,
                  })
                }
              />
            </ActionsLayout>
            <View style={{ height: insets.bottom + 12 }} />
          </SheetView>
        )}
      </Sheet>
    </View>
  )
}

const RailButton = ({
  icon,
  label,
  onPress,
}: {
  icon: string
  label: string
  onPress: () => void
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    onPress={onPress}
    style={styles.railButton}
  >
    <FeatherIcon name={icon as never} size={28} color="white" />
    <Text style={styles.railLabel}>{label}</Text>
  </Pressable>
)

const ClipProgress = ({
  length,
  getElapsed,
  bottom,
}: {
  length: number
  getElapsed: () => number
  bottom: number
}) => {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setElapsed(getElapsed()), 200)
    return () => clearInterval(timer)
  }, [getElapsed])
  const share = Math.max(0, Math.min(1, elapsed / length))
  return (
    <View style={[styles.progress, { bottom }]} importantForAccessibility="no-hide-descendants">
      <View style={[styles.progressFill, { width: `${share * 100}%` }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  player: { position: 'absolute', left: 0, right: 0, backgroundColor: '#000' },
  head: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headPicker: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  headTitle: { color: '#fff', fontSize: 17, fontWeight: '700', flexShrink: 1 },
  headRef: { color: 'rgba(255,255,255,0.75)', fontSize: 14, fontVariant: ['tabular-nums'] },
  rail: { position: 'absolute', right: 10, alignItems: 'center', gap: 20 },
  railButton: { alignItems: 'center', gap: 4, minWidth: 44 },
  railLabel: { color: '#fff', fontSize: 11, fontWeight: '600' },
  meta: { position: 'absolute', left: 16, right: 76, gap: 6 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#26405a',
    borderWidth: 1.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  whoName: { color: '#fff', fontWeight: '700', fontSize: 14, flexShrink: 1 },
  ref: { color: '#fff', fontWeight: '700', fontSize: 15 },
  refTime: { color: 'rgba(255,255,255,0.7)', fontWeight: '500', fontSize: 13 },
  verse: { color: '#fff', fontSize: 16, lineHeight: 23 },
  more: { color: '#fff', fontWeight: '700', fontSize: 14 },
  classTitle: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  progress: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  progressFill: { height: 2, backgroundColor: '#fff' },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 18, paddingHorizontal: 32 },
  emptyText: { color: 'rgba(255,255,255,0.8)', fontSize: 16, textAlign: 'center' },
  emptyButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  emptyButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  sheetBody: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16, gap: 14 },
  sheetTitle: { fontSize: 16, fontWeight: '700' },
  sheetVerse: { fontSize: 19, lineHeight: 30 },
  verseNumber: { color: GOLD, fontSize: 13, fontWeight: '600' },
  classRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 16,
  },
  classRowTitle: { fontSize: 14, fontWeight: '700' },
  classRowMeta: { fontSize: 13, opacity: 0.7 },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: { fontWeight: '700', fontSize: 12, fontVariant: ['tabular-nums'] },
})

export default ScriptureClipsScreen
