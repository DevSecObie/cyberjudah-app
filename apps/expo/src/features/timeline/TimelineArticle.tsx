import { Feather } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import React, { type ReactNode, useState } from 'react'
import { Linking, Pressable, View, useWindowDimensions } from 'react-native'
import WebView from 'react-native-webview'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import { getPassageMediaEmbedUrl } from '~features/bible/passageMedia'
import { getCommentaryBibleViewRoute } from '~features/commentaries/commentaryReferenceNavigation'
import { parseInlineBibleReferences } from '~helpers/bcvParser'
import { useTheme } from '~themes/ThemeProvider'
import { articlePieces, type ArticlePiece } from './articlePieces'

// An event's article as the Timeline writes it: paragraphs, where a class it cites is a line
// "Title — date — time" followed by the class's link at that moment. The class becomes a card that
// plays inside the page from that moment, and every scripture and link in the text opens.

const URL_IN_TEXT = /https?:\/\/[^\s)]+/g

/** A paragraph with each scripture opening the Bible and each web link opening in the browser. */
const LinkedText = ({ text, onOpenOsis }: { text: string; onOpenOsis: (osis: string) => void }) => {
  const parts: ReactNode[] = []
  const links = [
    ...parseInlineBibleReferences(text, 'en').map(reference => ({
      start: reference.start,
      end: reference.end,
      label: reference.text,
      open: () => onOpenOsis(reference.target.osis),
    })),
    ...[...text.matchAll(URL_IN_TEXT)].map(match => ({
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
      label: match[0],
      open: () => void Linking.openURL(match[0]),
    })),
  ].sort((left, right) => left.start - right.start)
  let at = 0
  for (const link of links) {
    if (link.start < at) continue
    if (link.start > at) parts.push(text.slice(at, link.start))
    parts.push(
      <Text key={link.start} className="text-primary" accessibilityRole="link" onPress={link.open}>
        {link.label}
      </Text>
    )
    at = link.end
  }
  if (at < text.length) parts.push(text.slice(at))
  return (
    <Paragraph className="mb-[16px]" scale={-1}>
      {parts}
    </Paragraph>
  )
}

/** A class the article cites: its picture and name, and its video playing here from the moment. */
const ClassCard = ({ piece }: { piece: Extract<ArticlePiece, { kind: 'class' }> }) => {
  const theme = useTheme()
  const { width } = useWindowDimensions()
  const [playing, setPlaying] = useState(false)
  const playerWidth = Math.min(width - 40, 720)
  const playerHeight = (playerWidth * 9) / 16
  return (
    <View
      style={{
        marginBottom: 20,
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.lightGrey,
      }}
    >
      {playing ? (
        <WebView
          source={{ uri: getPassageMediaEmbedUrl(piece.video, piece.seconds) }}
          style={{ width: playerWidth, height: playerHeight }}
          allowsInlineMediaPlayback
          allowsFullscreenVideo
          mediaPlaybackRequiresUserAction={false}
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Play ${piece.title ?? 'the class'}${piece.at ? ` from ${piece.at}` : ''}`}
          onPress={() => setPlaying(true)}
        >
          <Image
            source={{ uri: `https://i.ytimg.com/vi/${piece.video}/hqdefault.jpg` }}
            contentFit="cover"
            style={{ width: playerWidth, height: playerHeight }}
          />
          <View
            style={{
              position: 'absolute',
              inset: 0,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0,0,0,0.55)',
              }}
            >
              <Feather name="play" size={24} color="#fff" style={{ marginLeft: 3 }} />
            </View>
          </View>
        </Pressable>
      )}
      <View style={{ paddingHorizontal: 14, paddingVertical: 10, gap: 3 }}>
        {!!piece.title && (
          <Text className="text-[15px] font-bold" numberOfLines={2}>
            {piece.title}
          </Text>
        )}
        <Text className="text-grey text-[13px]">
          {[piece.date, piece.at ? `from ${piece.at}` : undefined].filter(Boolean).join(' · ') ||
            'Class'}
        </Text>
      </View>
    </View>
  )
}

/** The article, its scriptures and links tappable and the classes it cites playable in place. */
const TimelineArticle = ({ article }: { article: string }) => {
  const router = useRouter()
  const openOsis = (osis: string) => {
    const route = getCommentaryBibleViewRoute(osis)
    if (route) router.push(route)
  }
  return (
    <View style={{ marginTop: 20 }}>
      {articlePieces(article).map((piece, index) =>
        piece.kind === 'class' ? (
          <ClassCard key={index} piece={piece} />
        ) : (
          <LinkedText key={index} text={piece.text} onOpenOsis={openOsis} />
        )
      )}
    </View>
  )
}

export default TimelineArticle
