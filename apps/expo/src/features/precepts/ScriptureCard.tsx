import { useRouter } from 'expo-router'
import { HStack, TouchableBox, VStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { getCommentaryBibleViewRoute } from '~features/commentaries/commentaryReferenceNavigation'
import { cyberJudahSiteLinkToOsis } from '~helpers/cyberJudahSiteLinks'
import { resolveFontFamily } from '~themes/styleValues'
import { useTheme } from '~themes/ThemeProvider'
import { scriptureText, type Scripture } from './preceptsAndLaw'

/** A scripture as the precept cards show it: the reference, then its KJV text; it opens the Bible. */
export default function ScriptureCard({ scripture }: { scripture: Scripture }) {
  const theme = useTheme()
  const router = useRouter()
  const osis = cyberJudahSiteLinkToOsis(`https://cyberjudah.io${scripture.url}`)
  return (
    <TouchableBox
      accessibilityRole="link"
      disabled={!osis}
      onPress={() => {
        const route = osis && getCommentaryBibleViewRoute(osis)
        if (route) router.push(route)
      }}
    >
      <VStack className="rounded-[18px] bg-light-grey p-[16px] gap-[8px]">
        <HStack className="items-center gap-[10px]">
          <Text className="flex-[1] text-primary text-[18px] font-bold">{scripture.label}</Text>
          <FeatherIcon name="chevron-right" size={18} color="grey" />
        </HStack>
        <Text
          className="text-[17px] leading-[25px]"
          style={{ fontFamily: resolveFontFamily(theme.fontFamily.title), fontStyle: 'italic' }}
        >
          {scriptureText(scripture)}
        </Text>
      </VStack>
    </TouchableBox>
  )
}
