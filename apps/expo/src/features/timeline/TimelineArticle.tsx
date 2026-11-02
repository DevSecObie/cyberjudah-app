import { useRouter } from 'expo-router'
import React, { type ReactNode } from 'react'
import { View } from 'react-native'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import ClassVideoEmbed from '~features/passageMediaLibrary/ClassVideoEmbed'
import { getCommentaryBibleViewRoute } from '~features/commentaries/commentaryReferenceNavigation'
import { parseInlineBibleReferences } from '~helpers/bcvParser'
import { articlePieces, type ArticlePiece, withoutDisagreements } from './articlePieces'
import { openInApp } from '~common/inAppBrowser'

// An event's article as the Timeline writes it: paragraphs, where a class it cites is a line
// "Title — date — time" followed by the class's link at that moment. The class becomes a card that
// plays inside the page from that moment, and every scripture and link in the text opens: a
// Wikipedia page on a sheet inside the app, any other link in the browser.

const URL_IN_TEXT = /https?:\/\/[^\s)]+/g

/** A paragraph with each scripture opening the Bible and each web link opening where it reads. */
const LinkedText = ({
  text,
  onOpenOsis,
  onOpenUrl,
}: {
  text: string
  onOpenOsis: (osis: string) => void
  onOpenUrl: (url: string) => void
}) => {
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
      open: () => onOpenUrl(match[0]),
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
const ClassCard = ({ piece }: { piece: Extract<ArticlePiece, { kind: 'class' }> }) => (
  <View style={{ marginBottom: 20 }}>
    <ClassVideoEmbed
      videoId={piece.video}
      start={piece.seconds}
      title={piece.title}
      meta={
        [piece.date, piece.at ? `from ${piece.at}` : undefined].filter(Boolean).join(' · ') ||
        'Class'
      }
    />
  </View>
)

/** The article, its scriptures and links tappable and the classes it cites playable in place. */
const TimelineArticle = ({ article }: { article: string }) => {
  const router = useRouter()
  const openOsis = (osis: string) => {
    const route = getCommentaryBibleViewRoute(osis)
    if (route) router.push(route)
  }
  // Pages open on the in-app browser sheet, never in Safari.
  const openUrl = openInApp
  return (
    <View style={{ marginTop: 20 }}>
      {articlePieces(withoutDisagreements(article)).map((piece, index) =>
        piece.kind === 'class' ? (
          <ClassCard key={index} piece={piece} />
        ) : (
          <LinkedText key={index} text={piece.text} onOpenOsis={openOsis} onOpenUrl={openUrl} />
        )
      )}
    </View>
  )
}

export default TimelineArticle
