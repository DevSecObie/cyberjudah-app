import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { Image } from 'expo-image'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { useTranslation } from 'react-i18next'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useQuery } from '@tanstack/react-query'
import { usesCyberJudahEditorial } from '~helpers/editorialProfile'
import {
  loadClassLibrary,
  readCachedClassLibrary,
} from '~features/passageMediaLibrary/cyberJudahClasses'
const PassageMediaLibraryWidget = () => {
  const stylingTheme = useStylingTheme()

  const { t } = useTranslation()
  const pushRoute = usePushRouteOnce()
  const cyberJudah = usesCyberJudahEditorial()
  // CyberJudah's card shows the latest class, as in the Telegram app (same list as the library).
  const classLibrary = useQuery({
    queryKey: ['cyberjudah-class-library'],
    queryFn: () => loadClassLibrary(),
    initialData: () => readCachedClassLibrary() ?? undefined,
    initialDataUpdatedAt: 0,
    enabled: cyberJudah,
    staleTime: 5 * 60 * 1000,
    networkMode: 'always',
    retry: 1,
  })
  const latest = cyberJudah
    ? classLibrary.data?.find(item => item.series === 'Sabbath classes')
    : undefined

  return (
    <Box className="overflow-hidden border-continuous bg-light-grey pt-[20px]">
      <TouchableBox
        className="overflow-hidden border-continuous rounded-[20px] bg-reverse h-[136px] flex-row items-center"
        accessibilityRole="button"
        accessibilityLabel={t('passageMediaLibrary.open')}
        activeOpacity={0.84}
        onPress={() => pushRoute({ pathname: '/(library)/passage-media' })}
        style={{
          shadowColor: 'rgb(89,131,240)',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 7,
          elevation: 1,
          overflow: 'visible',
        }}
      >
        <Box className="border-continuous overflow-visible w-[48%] h-[100%] bg-light-grey rounded-tl-[20px] rounded-bl-[20px]">
          <Image
            source={
              latest
                ? { uri: latest.thumbnailUrl }
                : require('~assets/images/home/courses-videos.webp')
            }
            placeholder={latest ? { blurhash: latest.blurHash } : undefined}
            cachePolicy="memory-disk"
            contentFit="cover"
            contentPosition="center"
            style={{
              width: '100%',
              height: '100%',
              borderBottomLeftRadius: 20,
              borderTopLeftRadius: 20,
            }}
          />
        </Box>
        <Box className="overflow-hidden border-continuous flex-[1] h-[100%] px-[16px] pb-[24px] pt-[22px]">
          <Text
            className="text-[20px]"
            numberOfLines={2}
            style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
          >
            {t('passageMediaLibrary.title')}
          </Text>
          {!!latest && (
            <Text
              className="text-grey text-[13px] leading-[17px] mt-[6px] pr-[34px]"
              numberOfLines={2}
            >
              {latest.title}
            </Text>
          )}
          <Box
            className="overflow-hidden border-continuous absolute right-[14px] bottom-[12px] rounded-[18px] bg-light-primary items-center justify-center"
            style={{ width: 34, height: 34 }}
          >
            <FeatherIcon color="primary" name="chevron-right" size={20} />
          </Box>
        </Box>
      </TouchableBox>
    </Box>
  )
}

export default PassageMediaLibraryWidget
