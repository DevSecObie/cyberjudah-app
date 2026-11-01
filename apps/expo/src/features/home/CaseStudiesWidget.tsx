import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { Image } from 'expo-image'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'

/** Same composition as the Timeline card: the lion rises out of a light panel. */
const TINT_HEIGHT = 92
const ART_HEIGHT = 132
const ART_DROP = 10

/** CyberJudah's case studies, on the Learn shelf beside the Timeline (as the Telegram app has them). */
const CaseStudiesWidget = () => {
  const stylingTheme = useStylingTheme()
  const pushRoute = usePushRouteOnce()

  return (
    <Box
      className="border-continuous overflow-visible flex-[1] rounded-[20px]"
      style={{
        shadowColor: 'rgb(89,131,240)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 7,
        elevation: 1,
        overflow: 'visible',
      }}
    >
      <TouchableBox
        className="overflow-hidden border-continuous bg-reverse rounded-[20px] flex-[1]"
        accessibilityRole="button"
        accessibilityLabel="Case studies"
        activeOpacity={0.84}
        onPress={() => pushRoute({ pathname: '/(library)/case-studies' })}
      >
        <Box
          className="border-continuous rounded-t-[20px]"
          style={{ height: TINT_HEIGHT, backgroundColor: '#E6EDFF' }}
        />
        <Box className="overflow-hidden border-continuous flex-[1] p-[12px] pr-[48px]">
          <Text
            className="text-[15px] leading-[18px]"
            numberOfLines={2}
            style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
          >
            {'Case\nstudies'}
          </Text>
          <Box
            className="overflow-hidden border-continuous absolute right-[10px] bottom-[10px] rounded-[17px] bg-light-primary items-center justify-center"
            style={{ width: 32, height: 32 }}
          >
            <FeatherIcon color="primary" name="chevron-right" size={18} />
          </Box>
        </Box>
      </TouchableBox>
      <Image
        source={require('~assets/images/home/illustrations/dictionary-universe-v3.webp')}
        contentFit="contain"
        contentPosition="bottom"
        accessible={false}
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: TINT_HEIGHT - ART_HEIGHT,
          height: ART_HEIGHT + ART_DROP,
        }}
      />
    </Box>
  )
}

export default CaseStudiesWidget
