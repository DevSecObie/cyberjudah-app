import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { Pressable } from 'react-native'
import { useTranslation } from 'react-i18next'
import Box, { HStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { getCommentaryBibleViewRoute } from '~features/commentaries/commentaryReferenceNavigation'
import { loadPrecept, scriptureText } from '~features/precepts/preceptsAndLaw'
import { cyberJudahSiteLinkToOsis } from '~helpers/cyberJudahSiteLinks'
import { useAskPalette } from './askPalette'
import type { CyberJudahSource } from './cyberJudahAsk'
import { citedPrecepts } from './askStudyKinds'

// How much of a chain the card shows before "Open the whole precept".
const SHOWN = 3

/** One cited precept as a chain: its scriptures in Bible order, each opening the Bible. */
function PreceptChain({ n, slug, title }: { n: number; slug: string; title: string }) {
  const { t } = useTranslation()
  const router = useRouter()
  const p = useAskPalette()
  const precept = useQuery({
    queryKey: ['cyberjudah-precept', slug],
    queryFn: () => loadPrecept(slug),
    staleTime: 60 * 60 * 1000,
    networkMode: 'always',
    retry: 1,
  })
  const scriptures = precept.data?.refs.slice(0, SHOWN) ?? []
  const openPrecept = () => router.push({ pathname: '/(explore)/precept', params: { slug } })
  return (
    <Box
      className="overflow-hidden rounded-2xl"
      style={{ backgroundColor: p.surface1, borderWidth: 0.5, borderColor: p.edge }}
    >
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={t('askChat.openPrecept', {
          defaultValue: 'Open the precept {{title}}',
          title: precept.data?.title ?? title,
        })}
        onPress={openPrecept}
        className="flex-row items-center gap-[8px] p-3"
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <Box
          className="h-5 min-w-5 items-center justify-center rounded-full px-[5px]"
          style={{ backgroundColor: p.accentSoft }}
        >
          <Text style={{ color: p.accent, fontSize: 11, fontWeight: '700' }}>{n}</Text>
        </Box>
        <Box className="flex-1">
          <Text style={{ color: p.text3, fontSize: 11.5, fontWeight: '600' }}>
            {t('askChat.precept', { defaultValue: 'Precept' })}
          </Text>
          <Text numberOfLines={1} style={{ color: p.text1, fontSize: 16, fontWeight: '600' }}>
            {precept.data?.title ?? title}
          </Text>
        </Box>
        <FeatherIcon name="chevron-right" size={18} style={{ color: p.text3 }} />
      </Pressable>
      {scriptures.map((scripture, i) => {
        const osis = cyberJudahSiteLinkToOsis(`https://cyberjudah.io${scripture.url}`)
        const route = osis ? getCommentaryBibleViewRoute(osis) : undefined
        return (
          <Pressable
            key={scripture.label}
            accessibilityRole="link"
            accessibilityLabel={scripture.label}
            disabled={!route}
            onPress={() => route && router.push(route)}
            className="flex-row gap-[10px] px-3 pb-3"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            {/* The chain: one scripture leads to the next, as the classes line them up. */}
            <Box className="items-center" style={{ width: 12 }}>
              <Box
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  marginTop: 5,
                  backgroundColor: p.accent,
                }}
              />
              {i < scriptures.length - 1 && (
                <Box
                  style={{ flex: 1, width: 1.5, marginTop: 3, backgroundColor: p.accentAt(0.35) }}
                />
              )}
            </Box>
            <Box className="flex-1 gap-[2px]">
              <Text style={{ color: p.accent, fontSize: 14, fontWeight: '600' }}>
                {scripture.label}
              </Text>
              <Text
                numberOfLines={3}
                style={{ color: p.text1, fontSize: 14.5, lineHeight: 21, fontStyle: 'italic' }}
              >
                {scriptureText(scripture)}
              </Text>
            </Box>
          </Pressable>
        )
      })}
      {(precept.data?.refs.length ?? 0) > SHOWN && (
        <Pressable
          accessibilityRole="link"
          onPress={openPrecept}
          className="px-3 pb-3"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Text style={{ color: p.accent, fontSize: 14, fontWeight: '500' }}>
            {t('askChat.wholePrecept', { defaultValue: 'Open the whole precept' })}
          </Text>
        </Pressable>
      )}
    </Box>
  )
}

/** The precepts an answer cited, as chains of scripture under it. */
export default function AskPreceptChains({ sources }: { sources: CyberJudahSource[] }) {
  const cited = citedPrecepts(sources)
  if (!cited.length) return null
  return (
    <Box className="mt-4 gap-2">
      {cited.map(item => (
        <PreceptChain key={item.slug} {...item} />
      ))}
    </Box>
  )
}
