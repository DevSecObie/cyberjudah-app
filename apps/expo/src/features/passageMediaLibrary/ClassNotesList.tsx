import { Feather } from '@expo/vector-icons'
import React, { type ReactElement, type ReactNode } from 'react'
import { FlatList, Pressable, Text as NativeText, type TextStyle, View } from 'react-native'
import { useTheme } from '~themes/ThemeProvider'
import type { NoteBlock } from './cyberJudahClasses'

// A class's notes drawn with the app's own views, a block at a time, so a class of any length
// lays out like any other list. The look follows the website's notes and Bible Strong's verse
// blocks: headings, the passage with its time pill, the KJV quote, the precepts under it.

type Colors = { text: string; muted: string; link: string; surface: string; border: string }
type OnLink = (href: string) => void

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}
const decode = (text: string) =>
  text.replace(/&(#\d+|#x[\da-f]+|\w+);/gi, (match, name: string) =>
    name[0] === '#'
      ? String.fromCodePoint(
          name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : Number(name.slice(1))
        )
      : (ENTITIES[name.toLowerCase()] ?? match)
  )

type Node = { tag: string; href?: string; className?: string; children: (Node | string)[] }

/** The notes' small inline HTML (links, bold, italic, verse numbers) as a tree. */
const parseInline = (html: string): (Node | string)[] => {
  const root: Node = { tag: 'root', children: [] }
  const stack = [root]
  for (const part of html.split(/(<\/?[a-z]+\b[^>]*>)/i)) {
    if (!part) continue
    const tag = /^<(\/)?([a-z]+)\b([^>]*)>$/i.exec(part)
    if (!tag) {
      stack[stack.length - 1].children.push(decode(part))
    } else if (tag[1]) {
      const name = tag[2].toLowerCase()
      const at = stack.map(node => node.tag).lastIndexOf(name)
      if (at > 0) stack.length = at
    } else if (!/\/\s*$/.test(tag[3]) && tag[2].toLowerCase() !== 'br') {
      const node: Node = {
        tag: tag[2].toLowerCase(),
        href: /href="([^"]*)"/.exec(tag[3])?.[1],
        className: /class="([^"]*)"/.exec(tag[3])?.[1],
        children: [],
      }
      stack[stack.length - 1].children.push(node)
      stack.push(node)
    }
  }
  return root.children
}

const renderInline = (
  nodes: (Node | string)[],
  colors: Colors,
  onLink: OnLink,
  key = ''
): ReactNode[] =>
  nodes.map((node, index) => {
    const k = `${key}${index}`
    if (typeof node === 'string') return node
    const children = renderInline(node.children, colors, onLink, `${k}.`)
    if (node.tag === 'a' && node.href) {
      const href = decode(node.href)
      if (node.className === 'ts')
        return (
          <NativeText
            key={k}
            accessibilityRole="button"
            onPress={() => onLink(href)}
            style={{ color: colors.link, fontWeight: '600', fontSize: 14 }}
          >
            {'▶ '}
            {children}
          </NativeText>
        )
      return (
        <NativeText
          key={k}
          accessibilityRole="link"
          onPress={() => onLink(href)}
          style={{ color: colors.link }}
        >
          {children}
        </NativeText>
      )
    }
    const style: TextStyle | undefined =
      node.tag === 'b' || node.tag === 'strong'
        ? { fontWeight: '700' }
        : node.tag === 'i' || node.tag === 'em'
          ? { fontStyle: 'italic' }
          : node.tag === 'sup'
            ? { fontSize: 11, fontWeight: '700', color: colors.muted, fontStyle: 'normal' }
            : undefined
    return (
      <NativeText key={k} style={style}>
        {children}
      </NativeText>
    )
  })

const Inline = ({
  html,
  colors,
  onLink,
  style,
}: {
  html: string
  colors: Colors
  onLink: OnLink
  style?: TextStyle
}) => (
  <NativeText style={[{ color: colors.text, fontSize: 17, lineHeight: 27 }, style]}>
    {renderInline(parseInline(html), colors, onLink)}
  </NativeText>
)

/** The links in a passage line, without its time pill: the reference's own name. */
const stripSeek = (html: string) => html.replace(/<a class="ts"[^>]*>[^<]*<\/a>/g, '').trim()

const Block = ({
  block,
  colors,
  onLink,
  nested,
}: {
  block: NoteBlock
  colors: Colors
  onLink: OnLink
  nested?: boolean
}): ReactElement | null => {
  switch (block.type) {
    case 'heading':
      return (
        <View
          style={
            block.level <= 2
              ? {
                  marginTop: nested ? 12 : 30,
                  marginBottom: 12,
                  paddingBottom: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }
              : { marginTop: nested ? 10 : 22, marginBottom: 8 }
          }
        >
          <Inline
            html={block.html}
            colors={colors}
            onLink={onLink}
            style={{
              fontSize: block.level <= 2 ? 21 : 18,
              lineHeight: block.level <= 2 ? 27 : 24,
              fontWeight: '700',
            }}
          />
        </View>
      )
    case 'rule':
      return <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 24 }} />
    case 'paragraph':
      if (block.variant === 'label')
        return (
          <NativeText
            style={{
              color: colors.muted,
              fontSize: 12,
              fontWeight: '700',
              letterSpacing: 1,
              textTransform: 'uppercase',
              marginTop: 12,
              marginBottom: 6,
            }}
          >
            {block.html}
          </NativeText>
        )
      return (
        <View style={{ marginBottom: 12, marginTop: block.variant === 'passage' ? 18 : 0 }}>
          <Inline html={block.html} colors={colors} onLink={onLink} />
        </View>
      )
    case 'quote':
      return (
        <View
          style={{
            borderLeftWidth: 3,
            borderLeftColor: colors.border,
            paddingLeft: 12,
            marginBottom: 14,
          }}
        >
          <Blocks blocks={block.blocks} colors={colors} onLink={onLink} nested />
        </View>
      )
    case 'reading':
      return (
        <View
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingTop: 14,
            paddingBottom: 4,
            marginBottom: 16,
          }}
        >
          <Blocks blocks={block.blocks} colors={colors} onLink={onLink} nested />
        </View>
      )
    case 'list':
      return (
        <View style={{ marginBottom: 12 }}>
          {block.items.map((item, index) => (
            <View key={index} style={{ flexDirection: 'row', marginBottom: 8 }}>
              {!nested && (
                <NativeText
                  style={{ color: colors.muted, fontSize: 17, lineHeight: 27, width: 18 }}
                >
                  {'•'}
                </NativeText>
              )}
              <View style={{ flex: 1 }}>
                <Blocks blocks={item} colors={colors} onLink={onLink} nested />
              </View>
            </View>
          ))}
        </View>
      )
    case 'aside':
      return (
        <View
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingTop: 10,
            paddingBottom: 2,
            marginTop: 8,
            marginBottom: 16,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Feather
              name={
                block.label === 'In the News'
                  ? 'tv'
                  : block.label === 'Shown in class'
                    ? 'image'
                    : 'bell'
              }
              size={13}
              color={colors.muted}
            />
            <NativeText
              style={{
                color: colors.muted,
                fontSize: 12,
                fontWeight: '700',
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              {block.label}
            </NativeText>
          </View>
          <Blocks blocks={block.blocks} colors={colors} onLink={onLink} nested />
        </View>
      )
    case 'verse':
      return (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={block.title ? `${block.title}, King James Version` : undefined}
          disabled={!block.target}
          onPress={() => onLink(`bible://${block.target}`)}
          style={({ pressed }) => ({
            marginTop: nested ? 4 : 14,
            marginBottom: 14,
            paddingHorizontal: 12,
            paddingTop: 10,
            paddingBottom: 12,
            borderRadius: 10,
            backgroundColor: 'rgba(89, 131, 240, 0.08)',
            opacity: pressed ? 0.62 : 1,
          })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            {!!block.title && (
              <NativeText style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>
                {decode(block.title)}
              </NativeText>
            )}
            <NativeText style={{ color: colors.muted, fontSize: 13, fontWeight: '700' }}>
              KJV
            </NativeText>
            <View style={{ flex: 1 }} />
            {!!block.seek && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Play from ${block.seek.label}`}
                hitSlop={8}
                onPress={() => onLink(decode(block.seek!.href))}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  paddingHorizontal: 9,
                  paddingVertical: 5,
                  borderRadius: 999,
                  backgroundColor: colors.surface,
                }}
              >
                <Feather name="play" size={10} color={colors.link} />
                <NativeText
                  style={{
                    color: colors.link,
                    fontSize: 13,
                    fontWeight: '600',
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {block.seek.label}
                </NativeText>
              </Pressable>
            )}
          </View>
          <View style={{ paddingRight: 28 }}>
            {block.blocks.map((inner, index) =>
              inner.type === 'paragraph' ? (
                <View key={index} style={{ marginBottom: 6 }}>
                  <Inline
                    html={stripSeek(inner.html).replace(/<\/?a\b[^>]*>/g, '')}
                    colors={colors}
                    onLink={onLink}
                    style={{ fontStyle: 'italic' }}
                  />
                </View>
              ) : (
                <Block key={index} block={inner} colors={colors} onLink={onLink} nested />
              )
            )}
          </View>
          <View style={{ position: 'absolute', right: 14, bottom: 12 }}>
            <Feather name="arrow-right" size={18} color={colors.text} />
          </View>
        </Pressable>
      )
  }
}

const Blocks = ({
  blocks,
  colors,
  onLink,
  nested,
}: {
  blocks: NoteBlock[]
  colors: Colors
  onLink: OnLink
  nested?: boolean
}) => (
  <>
    {blocks.map((block, index) => (
      <Block key={index} block={block} colors={colors} onLink={onLink} nested={nested} />
    ))}
  </>
)

/** The notes as a list that lays out only what is on screen, under whatever comes first. */
export default function ClassNotesList({
  blocks,
  onLinkPress,
  header,
  width,
}: {
  blocks: NoteBlock[]
  onLinkPress: OnLink
  header?: ReactElement
  width: number
}) {
  const theme = useTheme()
  const colors: Colors = {
    text: theme.colors.default,
    muted: theme.colors.grey,
    link: theme.colors.primary,
    surface: theme.colors.lightGrey,
    border: theme.colors.border,
  }
  return (
    <FlatList
      data={blocks}
      keyExtractor={(_, index) => String(index)}
      ListHeaderComponent={header}
      renderItem={({ item }) => (
        <View style={{ width, alignSelf: 'center' }}>
          <Block block={item} colors={colors} onLink={onLinkPress} />
        </View>
      )}
      initialNumToRender={12}
      windowSize={7}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingTop: 16, paddingBottom: 48 }}
      style={{ flex: 1, backgroundColor: theme.colors.reverse }}
    />
  )
}
