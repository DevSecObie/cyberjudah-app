import { Linking } from 'react-native'
import { EnrichedMarkdownText } from 'react-native-enriched-markdown'
import { useTheme } from '~themes/ThemeProvider'
import { prepareMarkdown, safeLink } from './markdown'
export default function AssistantMarkdown({
  text,
  streaming,
  onLinkPress,
}: {
  text: string
  streaming: boolean
  onLinkPress?: (url: string) => boolean
  sources?: import('@bible-strong/ai-contract/contract').StudySource[]
  widgets?: import('@bible-strong/ai-contract/contract').StudyWidget[]
}) {
  const { colors } = useTheme()
  // Every block takes the theme's text colour and the app's own font, so lists, quotes and tables
  // read like the paragraphs in every theme.
  const body = { color: colors.default, fontSize: 16, lineHeight: 25 }
  // The native renderer handles partial Markdown. Avoid the remend worklet, which
  // fails on the device and leaves even completed answers blank.
  return (
    <EnrichedMarkdownText
      markdown={prepareMarkdown(text)}
      flavor="github"
      selectable={!streaming}
      md4cFlags={{ latexMath: false }}
      onLinkPress={({ url }) => {
        if (onLinkPress?.(url)) return
        const safe = safeLink(url)
        if (safe) void Linking.openURL(safe).catch(() => {})
      }}
      markdownStyle={{
        paragraph: body,
        h1: { color: colors.default, fontSize: 22 },
        h2: { color: colors.default, fontSize: 20 },
        h3: { color: colors.default, fontSize: 18 },
        h4: { color: colors.default, fontSize: 17 },
        h5: { color: colors.default, fontSize: 16 },
        h6: { color: colors.default, fontSize: 16 },
        list: { ...body, bulletColor: colors.grey, markerColor: colors.grey },
        blockquote: { ...body, borderColor: colors.border, backgroundColor: colors.lightGrey },
        strong: { color: colors.default },
        em: { color: colors.default },
        link: { color: colors.default, underline: true },
        code: { color: colors.default, backgroundColor: colors.lightGrey },
        codeBlock: { color: colors.default, backgroundColor: colors.lightGrey },
        table: {
          ...body,
          headerTextColor: colors.default,
          headerBackgroundColor: colors.lightGrey,
          borderColor: colors.border,
        },
        thematicBreak: { color: colors.border },
      }}
    />
  )
}
