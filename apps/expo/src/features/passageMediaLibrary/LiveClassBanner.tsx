import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { TouchableBox, VStack } from '~common/ui/Box'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { usesCyberJudahEditorial } from '~helpers/editorialProfile'
import { liveClassBanner, loadLiveClass, readCachedClassLibrary } from './cyberJudahClasses'

/**
 * As in the Telegram app: the class on the air now, or the next one within six hours, checked
 * every minute while the screen is open. Nothing shows when there is none or the server can't say.
 */
const LiveClassBanner = ({ className }: { className?: string }) => {
  const router = useRouter()
  const cyberJudah = usesCyberJudahEditorial()
  const live = useQuery({
    queryKey: ['cyberjudah-live-class'],
    queryFn: () => loadLiveClass(),
    enabled: cyberJudah,
    refetchInterval: 60_000,
    staleTime: 45_000,
    retry: false,
  })
  const banner = liveClassBanner(live.data)
  if (!banner) return null
  const listed = readCachedClassLibrary()?.find(item => item.providerId === banner.video)
  const label = banner.starts
    ? `Starting ${new Date(banner.starts).toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      })}`
    : 'Live now'
  return (
    <TouchableBox
      className={`overflow-hidden border-continuous rounded-[16px] bg-reverse border-[1px] border-border flex-row items-center gap-[12px] px-[16px] py-[14px] ${className ?? ''}`}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${banner.title}`}
      activeOpacity={0.84}
      onPress={() =>
        router.push({
          pathname: '/(explore)/passage-media-player',
          params: listed ? { workId: listed.workId } : { video: banner.video, title: banner.title },
        })
      }
    >
      <Box
        className="rounded-full w-[10px] h-[10px]"
        style={{ backgroundColor: banner.starts ? '#F5A524' : '#E5484D' }}
      />
      <VStack className="flex-[1] gap-[2px]">
        <Text className="font-bold text-primary text-[12px]">{label}</Text>
        <Text className="text-[16px] leading-[20px]" numberOfLines={2}>
          {banner.title}
        </Text>
      </VStack>
      <FeatherIcon name="play" size={20} color="primary" />
    </TouchableBox>
  )
}

export default LiveClassBanner
