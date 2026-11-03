import { Feather } from '@expo/vector-icons'
import { useQueries, useQuery } from '@tanstack/react-query'
import React, { type ReactNode } from 'react'
import { Image, Pressable, StyleSheet, Text as NativeText, View } from 'react-native'
import { useRouter } from 'expo-router'
import { getStrongEntityPlaceholderSource } from '~features/lexique/strongEntityAvatars'
import { useEntityPortraitCatalog } from '~features/lexique/entityPortraitManifest'
import {
  getEntityAvatarRadius,
  getEntityChapterPortraitHash,
  getEntityPortraitUri,
} from '~features/lexique/entityPortraits'
import {
  getEntityPortraitLocalUri,
  useEntityPortraitLocalHashes,
} from '~features/lexique/entityPortraitPack'
import { createStrongDetailRoute } from '~features/lexique/strongDetailRoutes'
import { loadTopics } from '~features/publishedNotes/classTeaching'
import { useResourceAccess } from '~features/resources/resourceAccess'
import type { StrongLexiconChapterEntity } from '~features/resources/strongLexiconAccess'
import { osisToBibleReferenceTarget } from '~helpers/bcvParser'
import { localQueryOptions } from '~helpers/queryOptions'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { useTheme } from '~themes/ThemeProvider'
import type { NoteBlock } from './cyberJudahClasses'
export { groupScriptures, type ScriptureGroup } from './classNotesGroups'

// The class notes in the look of Bible Strong's Go Deeper study (FocusVerseStudy, ADR-0088): a
// small grey title over each scripture, its card with thin lines between rows and blue links,
// and the people and places its verses name. Drawn with the app's own views, one list row per card.

export type DeeperColors = {
  text: string
  muted: string
  link: string
  surface: string
  canvas: string
  separator: string
}

const Row = ({ first, children }: { first?: boolean; children: ReactNode }) => {
  const { separator } = useDeeperColors()
  return (
    <View
      style={{
        marginLeft: 16,
        paddingVertical: 12,
        paddingRight: 16,
        borderTopWidth: first ? 0 : StyleSheet.hairlineWidth,
        borderTopColor: separator,
      }}
    >
      {children}
    </View>
  )
}

export const useDeeperColors = (): DeeperColors => {
  const theme = useTheme()
  const colors = theme.colors as unknown as Record<string, string>
  return {
    text: theme.colors.default,
    muted: theme.colors.grey,
    link: theme.colors.primary,
    surface: colors.surface ?? theme.colors.reverse,
    canvas: colors.canvas ?? theme.colors.lightGrey,
    separator: colors.separator ?? theme.colors.border,
  }
}

/** A blue line of a card: "▶ Play from 8:06 ›" on top, "Malachi 3:16 in the Bible ›" below. */
export const CardLink = ({
  label,
  icon,
  onPress,
  position,
}: {
  label: string
  icon?: 'play'
  onPress: () => void
  position: 'top' | 'bottom'
}) => {
  const colors = useDeeperColors()
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 13,
        borderTopWidth: position === 'bottom' ? StyleSheet.hairlineWidth : 0,
        borderBottomWidth: position === 'top' ? StyleSheet.hairlineWidth : 0,
        borderColor: colors.separator,
        opacity: pressed ? 0.55 : 1,
      })}
    >
      {icon === 'play' && <Feather name="play" size={13} color={colors.link} />}
      <NativeText
        style={{
          flex: 1,
          color: colors.link,
          fontSize: 15,
          fontWeight: '500',
          fontVariant: ['tabular-nums'],
        }}
      >
        {label}
      </NativeText>
      <Feather name="chevron-right" size={16} color={colors.link} />
    </Pressable>
  )
}

/** The grey title over a card, as Go Deeper names each of its sections. */
export const SectionTitle = ({ children }: { children: ReactNode }) => {
  const colors = useDeeperColors()
  return (
    <NativeText style={{ marginHorizontal: 4, marginBottom: 8, fontSize: 13, color: colors.muted }}>
      {children}
    </NativeText>
  )
}

export const Card = ({ children }: { children: ReactNode }) => {
  const colors = useDeeperColors()
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: 12, overflow: 'hidden' }}>
      {children}
    </View>
  )
}

export { Row }

const verseSetOf = (target: string) => {
  const reference = osisToBibleReferenceTarget(target)
  if (!reference) return undefined
  return {
    book: reference.book,
    chapter: reference.chapter,
    verses: new Set(reference.focusVerses?.length ? reference.focusVerses : [reference.verse]),
  }
}

const useChapterEntities = (book: number, chapter: number, enabled = true) => {
  const resources = useResourceAccess()
  return useQuery({
    queryKey: resourceQueryKeys.strongLexiconChapterEntities({
      language: 'en',
      book,
      chapter,
      strongCodes: [],
    }),
    queryFn: () => resources.strongLexicon.loadChapterEntities(book, chapter, 'en', []),
    enabled: enabled && book > 0 && chapter > 0,
    staleTime: Infinity,
    ...localQueryOptions,
  })
}

/** The portrait of an entity for a chapter, from the offline pack when the phone holds it. */
const usePortraitOf = () => {
  const catalog = useEntityPortraitCatalog()
  const local = useEntityPortraitLocalHashes()
  return (entity: StrongLexiconChapterEntity, book: number, chapter: number) => {
    const entry = catalog?.entities[entity.uniqueName]
    if (!entry) return undefined
    const hash = getEntityChapterPortraitHash(entry, book, chapter)
    if (!hash) return undefined
    return !__DEV__ && local.has(hash)
      ? getEntityPortraitLocalUri(hash, 'w256')
      : getEntityPortraitUri(entity.uniqueName, hash)
  }
}

const AVATAR = 32

/** An entity as Go Deeper shows it: its portrait (or clay figure) and its name; it opens its card. */
const EntityChip = ({
  entity,
  book,
  chapter,
  portrait,
  onCard,
}: {
  entity: StrongLexiconChapterEntity
  book: number
  chapter: number
  portrait?: string
  /** Inside a card the chip takes the page's ground; on the page, the card's. */
  onCard?: boolean
}) => {
  const colors = useDeeperColors()
  const pushRouteOnce = usePushRouteOnce()
  const placeholder = getStrongEntityPlaceholderSource(
    entity.category === 'supernatural' ? 'other' : entity.category,
    entity.type,
    entity.uniqueName
  )
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={entity.name}
      onPress={() =>
        pushRouteOnce(
          createStrongDetailRoute(
            'entity',
            { book, bibleChapter: chapter },
            { entityKey: entity.uniqueName }
          )
        )
      }
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 3,
        paddingLeft: 3,
        paddingRight: 12,
        borderRadius: 12,
        backgroundColor: onCard ? colors.canvas : colors.surface,
        opacity: pressed ? 0.55 : 1,
      })}
    >
      <Image
        source={portrait ? { uri: portrait } : placeholder}
        accessibilityIgnoresInvertColors
        style={{ width: AVATAR, height: AVATAR, borderRadius: getEntityAvatarRadius(AVATAR) }}
      />
      <NativeText style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
        {entity.name}
      </NativeText>
    </Pressable>
  )
}

const Chips = ({ children }: { children: ReactNode }) => (
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>
)

/** The people and places named in a scripture's own verses, under its card's verses. */
export const VerseEntities = ({ target }: { target?: string }) => {
  const set = target ? verseSetOf(target) : undefined
  const query = useChapterEntities(set?.book ?? 0, set?.chapter ?? 0, !!set)
  const portraitOf = usePortraitOf()
  if (!set) return null
  const named = (query.data ?? []).filter(
    entity =>
      (entity.category === 'person' ||
        entity.category === 'place' ||
        entity.category === 'group') &&
      entity.verses.some(verse => set.verses.has(verse))
  )
  if (!named.length) return null
  return (
    <Row>
      <Chips>
        {named.slice(0, 8).map(entity => (
          <EntityChip
            key={entity.uniqueName}
            entity={entity}
            book={set.book}
            chapter={set.chapter}
            portrait={portraitOf(entity, set.book, set.chapter)}
            onCard
          />
        ))}
      </Chips>
    </Row>
  )
}

const collectTargets = (blocks: NoteBlock[], into: string[] = []): string[] => {
  for (const block of blocks) {
    if (block.type === 'verse') {
      if (block.target) into.push(block.target)
      collectTargets(block.blocks, into)
    } else if (block.type === 'list') block.items.forEach(item => collectTargets(item, into))
    else if ('blocks' in block) collectTargets(block.blocks, into)
  }
  return into
}

/**
 * At the head of the notes: the people and places the class's scriptures name, most named first,
 * and the class's topics, each a door to its page.
 */
export const ClassStudyHeader = ({
  blocks,
  topics,
}: {
  blocks: NoteBlock[]
  topics?: string[]
}) => {
  const colors = useDeeperColors()
  const router = useRouter()
  const portraitOf = usePortraitOf()
  const resources = useResourceAccess()
  const sets = [
    ...new Map(
      collectTargets(blocks)
        .map(verseSetOf)
        .filter((set): set is NonNullable<typeof set> => !!set)
        .map(set => [`${set.book}.${set.chapter}`, set])
    ).values(),
  ]
  // Every verse of a chapter the class quoted, so each entity is counted once per verse.
  const verses = new Map<string, Set<number>>()
  for (const target of collectTargets(blocks)) {
    const set = verseSetOf(target)
    if (!set) continue
    const key = `${set.book}.${set.chapter}`
    const all = verses.get(key) ?? new Set<number>()
    set.verses.forEach(verse => all.add(verse))
    verses.set(key, all)
  }
  const chapters = useQueries({
    queries: sets.map(set => ({
      queryKey: resourceQueryKeys.strongLexiconChapterEntities({
        language: 'en',
        book: set.book,
        chapter: set.chapter,
        strongCodes: [],
      }),
      queryFn: () => resources.strongLexicon.loadChapterEntities(set.book, set.chapter, 'en', []),
      staleTime: Infinity,
      ...localQueryOptions,
    })),
  })
  const topicRows = useQuery({
    queryKey: ['cyberjudah-topics'],
    queryFn: () => loadTopics(),
    enabled: !!topics?.length,
    staleTime: 60 * 60 * 1000,
    networkMode: 'always',
    retry: 1,
  })
  const counts = new Map<
    string,
    { entity: StrongLexiconChapterEntity; book: number; chapter: number; count: number }
  >()
  sets.forEach((set, index) => {
    const quoted = verses.get(`${set.book}.${set.chapter}`) ?? set.verses
    for (const entity of chapters[index]?.data ?? []) {
      const hits = entity.verses.filter(verse => quoted.has(verse)).length
      if (!hits) continue
      const seen = counts.get(entity.uniqueName)
      if (seen) seen.count += hits
      else
        counts.set(entity.uniqueName, { entity, book: set.book, chapter: set.chapter, count: hits })
    }
  })
  const ranked = [...counts.values()].sort((a, b) => b.count - a.count)
  const people = ranked.filter(
    row => row.entity.category === 'person' || row.entity.category === 'group'
  )
  const places = ranked.filter(row => row.entity.category === 'place')
  const labels = new Map((topicRows.data ?? []).map(row => [row.slug, row.label]))
  const shownTopics = (topics ?? []).filter(slug => labels.has(slug))

  const section = (title: string, rows: typeof ranked) =>
    rows.length ? (
      <View style={{ gap: 8 }}>
        <SectionTitle>{title}</SectionTitle>
        <Chips>
          {rows.slice(0, 12).map(row => (
            <EntityChip
              key={row.entity.uniqueName}
              entity={row.entity}
              book={row.book}
              chapter={row.chapter}
              portrait={portraitOf(row.entity, row.book, row.chapter)}
            />
          ))}
        </Chips>
      </View>
    ) : null

  if (!people.length && !places.length && !shownTopics.length) return null
  return (
    <View style={{ gap: 18, marginTop: 6, marginBottom: 8 }}>
      {section('People in this class', people)}
      {section('Places', places)}
      {shownTopics.length > 0 && (
        <View style={{ gap: 8 }}>
          <SectionTitle>Topics</SectionTitle>
          <Chips>
            {shownTopics.map(slug => (
              <Pressable
                key={slug}
                accessibilityRole="link"
                onPress={() => router.push({ pathname: '/(explore)/topic', params: { slug } })}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  borderRadius: 999,
                  backgroundColor: colors.surface,
                  opacity: pressed ? 0.55 : 1,
                })}
              >
                <View
                  style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.link }}
                />
                <NativeText style={{ color: colors.text, fontSize: 14 }}>
                  {labels.get(slug)}
                </NativeText>
              </Pressable>
            ))}
          </Chips>
        </View>
      )}
    </View>
  )
}
