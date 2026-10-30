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
        paragraph: { color: colors.default, fontSize: 16, lineHeight: 25 },
        h1: { color: colors.default, fontSize: 22 },
        h2: { color: colors.default, fontSize: 20 },
        h3: { color: colors.default, fontSize: 18 },
        strong: { color: colors.default },
        link: { color: colors.default, underline: true },
        code: { color: colors.default, backgroundColor: colors.lightGrey },
        codeBlock: { color: colors.default, backgroundColor: colors.lightGrey },
      }}
    />
  )
}
