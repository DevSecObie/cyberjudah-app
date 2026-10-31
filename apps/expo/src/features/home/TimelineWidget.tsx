import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { twMerge } from '~common/ui/classNames'
import React from 'react'
import { Image } from 'expo-image'
import { useTranslation } from 'react-i18next'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
const LinkBox = (props: React.ComponentProps<typeof Box> & React.ComponentProps<typeof Link>) => (
  <Box
    as={Link}
    {...props}
    className={twMerge(
      'overflow-hidden border-continuous',
      twMerge('overflow-hidden border-continuous', props.className)
    )}
  />
)

/** Light panel at the top of the card; the lion is taller, so his head rises above the card. */
const TINT_HEIGHT = 92
const ART_HEIGHT = 132
/** The scroll in front of the lion spills a little onto the title area. */
const ART_DROP = 10
export const TIMELINE_ART_OVERFLOW = ART_HEIGHT - TINT_HEIGHT

const TimelineWidget = () => {
  const stylingTheme = useStylingTheme()

  const { t } = useTranslation()

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
      <LinkBox className="bg-reverse rounded-[20px] flex-[1]" route="TimelineHome">
        {/* The panel keeps its light colour in every theme, like the picture it frames. */}
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
            {t('La Chronologie\nde la Bible')}
          </Text>
          <Box
            className="overflow-hidden border-continuous absolute right-[10px] bottom-[10px] rounded-[17px] bg-light-primary items-center justify-center"
            style={{ width: 32, height: 32 }}
          >
            <FeatherIcon color="primary" name="chevron-right" size={18} />
          </Box>
        </Box>
      </LinkBox>
      {/* Drawn over the card, outside its clipped corners, so the lion can rise above it. */}
      <Image
        source={require('~assets/images/home/bible-timeline.webp')}
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

export default TimelineWidget
