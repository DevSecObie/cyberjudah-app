import { useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewToken,
} from 'react-native'
import { SystemBars } from 'react-native-edge-to-edge'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSelector } from 'react-redux'
import Sheet from '~common/ModalSheet'
import { SheetScrollView, type SheetRef } from '~common/sheet'
import { FeatherIcon } from '~common/ui/Icon'
import ThemedText from '~common/ui/Text'
import dayData from '~assets/cyberjudah/scripture-clips/genesis-1-4.json'
import { formatPassageMediaDuration, getPassageMediaEmbedUrl } from '~features/bible/passageMedia'
import ClassVideoFrame, {
  type ClassVideoFrameHandle,
} from '~features/passageMediaLibrary/ClassVideoFrame'
import { useOpenSiteLink } from '~features/publishedNotes/siteLinks'
import type { RootState } from '~redux/modules/reducer'
import { resolveFontFamily } from '~themes/styleValues'
import AnimatedCaption from './AnimatedCaption'
import { clipLength, type ScriptureClip, type ScriptureClipDay } from './scriptureClips'

const day = dayData as ScriptureClipDay
const GOLD = '#E0B44A'

type Loaded = { video: string; start: number }

/**
 * Scripture Clips (preview): the day's chapters as a Shorts style feed, one verse per screen.
 * The class video plays in place at the second the verse is read, the class's words appear
 * under it as they are said, and the feed moves to the next verse when the class does. This is
 * a CyberJudah component, not one of Bible Strong's.
 */
const ScriptureClipsScreen = () => {
  const router = useRouter()
  const { open, openMoment } = useOpenSiteLink()
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const bibleFont = useSelector((state: RootState) => state.user.fontFamily)
  const clips = day.clips
  const list = useRef<FlatList<ScriptureClip>>(null)
  const frame = useRef<ClassVideoFrameHandle>(null)
  const sheet = useRef<SheetRef>(null)
  const [index, setIndex] = useState(0)
  const [sheetClip, setSheetClip] = useState<ScriptureClip | null>(null)
  const firstWithVideo = clips.find(clip => clip.video && clip.start !== undefined)
  const [loaded, setLoaded] = useState<Loaded | null>(
    firstWithVideo ? { video: firstWithVideo.video!, start: firstWithVideo.start! } : null
  )
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

  // A verse came on screen: play it from its second, unless the video is already there.
  useEffect(() => {
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
    const next = indexRef.current + 1
    if (next >= clips.length) return
    advancing.current = clips[next].video === clips[indexRef.current].video
    list.current?.scrollToIndex({ index: next, animated: true })
  }, [clips])

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

  const chapterPath = (item: ScriptureClip) => `/bible/${day.slug}/${item.c}`
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
            onPress={() => open(`/study/${day.slug}/${item.c}`)}
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
            {day.book} {item.c}:{item.v}
            {item.start !== undefined && (
              <Text style={styles.refTime}>
                {'  '}
                {formatPassageMediaDuration(item.start)} · {formatPassageMediaDuration(length)}
              </Text>
            )}
          </Text>
          <Text style={[styles.verse, scriptureFont]} numberOfLines={2}>
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
        keyExtractor={item => `${item.c}:${item.v}`}
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
        <Text style={styles.headTitle}>
          {day.book} {clip?.c}
        </Text>
        <Text style={styles.headRef}>
          {clip?.c}:{clip?.v}
        </Text>
      </View>
      <Sheet ref={sheet} modalTitle={sheetClip ? `${day.book} ${sheetClip.c}:${sheetClip.v}` : ''}>
        <SheetScrollView>
          {sheetClip && (
            <View style={styles.sheetBody}>
              <ThemedText style={styles.sheetTitle}>
                {day.book} {sheetClip.c}:{sheetClip.v}
              </ThemedText>
              <ThemedText style={[styles.sheetVerse, scriptureFont]}>
                <ThemedText style={styles.verseNumber}>{sheetClip.v} </ThemedText>
                {sheetClip.text}
              </ThemedText>
              {!!sheetClip.video && (
                <Pressable
                  accessibilityRole="link"
                  onPress={() => sheet.current?.dismissThen(() => openClass(sheetClip))}
                  style={styles.classRow}
                >
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.classRowTitle} numberOfLines={2}>
                      {sheetClip.title}
                    </ThemedText>
                    <ThemedText style={styles.classRowMeta}>
                      {[sheetClip.teacher, sheetClip.series, sheetClip.date]
                        .filter(Boolean)
                        .join(' · ')}
                    </ThemedText>
                  </View>
                  {sheetClip.start !== undefined && (
                    <View style={styles.pill}>
                      <ThemedText style={styles.pillText}>
                        ▶ {formatPassageMediaDuration(sheetClip.start)}
                      </ThemedText>
                    </View>
                  )}
                </Pressable>
              )}
              <View style={styles.sheetActions}>
                <Pressable
                  style={styles.sheetButton}
                  onPress={() => sheet.current?.dismissThen(() => open(chapterPath(sheetClip)))}
                >
                  <ThemedText style={styles.sheetButtonText}>Read chapter</ThemedText>
                </Pressable>
                <Pressable
                  style={styles.sheetButton}
                  onPress={() =>
                    sheet.current?.dismissThen(() => open(`/study/${day.slug}/${sheetClip.c}`))
                  }
                >
                  <ThemedText style={styles.sheetButtonText}>Study note</ThemedText>
                </Pressable>
              </View>
            </View>
          )}
        </SheetScrollView>
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
  headTitle: { flex: 1, color: '#fff', fontSize: 17, fontWeight: '700' },
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
  sheetBody: { padding: 20, gap: 14 },
  sheetTitle: { fontSize: 18, fontWeight: '700' },
  sheetVerse: { fontSize: 19, lineHeight: 30 },
  verseNumber: { color: GOLD, fontSize: 13, fontWeight: '600' },
  classRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(127,127,127,0.14)',
  },
  classRowTitle: { fontSize: 14, fontWeight: '700' },
  classRowMeta: { fontSize: 13, opacity: 0.7 },
  pill: {
    backgroundColor: '#2fd3bd',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: { color: '#0b1624', fontWeight: '700', fontSize: 12, fontVariant: ['tabular-nums'] },
  sheetActions: { flexDirection: 'row', gap: 10 },
  sheetButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(127,127,127,0.18)',
  },
  sheetButtonText: { fontSize: 14, fontWeight: '600' },
})

export default ScriptureClipsScreen
