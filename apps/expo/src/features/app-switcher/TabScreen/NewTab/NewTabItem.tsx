import { useLaunchSearch } from '../../commandPalette/useLaunchSearch'
import { Image } from 'expo-image'
import { useAtom } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import React from 'react'
import { Platform } from 'react-native'
import { useTranslation } from 'react-i18next'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import TabIcon from '~features/app-switcher/utils/getIconByTabType'
import { getDefaultData, TabItem } from '../../../../state/tabs'
interface NewTabItemProps {
  type: TabItem['type']
  newAtom: PrimitiveAtom<TabItem>
  onPlanPress?: () => void
  title?: string
  description?: string
  hero?: boolean
  compact?: boolean
}

const useOpenTabByType = ({ type, newAtom }: NewTabItemProps) => {
  const launchSearch = useLaunchSearch()
  const [tab, setTab] = useAtom(newAtom)
  const onPress = () => {
    if (launchSearch(type, Platform.OS === 'web' ? undefined : newAtom)) return
    setTab({ ...tab, base64Preview: '', type, ...getDefaultData(type) } as TabItem)
  }

  return {
    onPress,
  }
}

const NewTabItem = ({
  type,
  newAtom,
  onPlanPress,
  title,
  description,
  hero = false,
  compact = false,
}: NewTabItemProps) => {
  const { t } = useTranslation()
  const { onPress } = useOpenTabByType({ type, newAtom, onPlanPress })
  const isLibraryResource =
    type === 'strong' || type === 'nave' || type === 'dictionary' || type === 'commentary'
  const heroArt = compact
    ? { width: 150, height: 102, rise: 36, right: 14 }
    : { width: 280, height: 190, rise: 56, right: 32 }
  const iconSize = hero ? (Platform.OS === 'web' ? 64 : 40) : isLibraryResource ? 34 : 28

  return (
    <TouchableBox
      testID={`new-tab-tool-${type}`}
      accessibilityLabel={title ?? t(`tabs.${type}`)}
      accessibilityHint={description}
      activeOpacity={0.7}
      className={
        hero
          ? 'relative overflow-visible border-continuous flex-row items-center bg-reverse shadow-[0_2px_7px_rgba(89,131,240,0.1)] rounded-[18px] px-[24px] py-[24px]'
          : 'border-continuous flex-row items-center bg-reverse shadow-[0_2px_7px_rgba(89,131,240,0.1)] rounded-[18px] px-[18px] py-[18px] min-h-[92px] gap-[14px]'
      }
      style={
        hero
          ? { minHeight: compact ? 180 : 218, marginTop: Math.max(0, heroArt.rise - 42) }
          : undefined
      }
      onPress={onPress}
    >
      <Box
        className={
          hero
            ? 'flex-1 flex-row items-center gap-[24px] z-10'
            : 'flex-row items-center flex-1 gap-[14px]'
        }
        style={
          hero
            ? {
                paddingRight: compact ? 82 : 270,
                ...(Platform.OS !== 'web' && { alignItems: 'flex-start' }),
              }
            : undefined
        }
      >
        <TabIcon type={type} size={iconSize} />
        <Box className="flex-1 min-w-0 gap-[6px]">
          <Text className={hero ? 'text-[36px] font-medium' : 'text-[16px] font-medium'}>
            {title ?? t(`tabs.${type}`)}
          </Text>
          {description ? (
            <Text className="text-[13px] leading-[19px] text-tertiary">{description}</Text>
          ) : null}
        </Box>
      </Box>
      {hero && (
        <>
          {/* Light panel in the card's corner; the lion sits on it and rises above the card. */}
          <Box
            pointerEvents="none"
            className="border-continuous rounded-tr-[18px] rounded-bl-[18px]"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: heroArt.width + heroArt.right * 2,
              height: heroArt.height - heroArt.rise,
              backgroundColor: '#E6EDFF',
            }}
          />
          <Image
            source={require('~assets/images/new-tab/bible-reader.webp')}
            accessible={false}
            pointerEvents="none"
            contentFit="contain"
            contentPosition="bottom"
            style={{
              position: 'absolute',
              right: heroArt.right,
              top: -heroArt.rise,
              width: heroArt.width,
              height: heroArt.height,
            }}
          />
        </>
      )}
      <FeatherIcon name="chevron-right" size={hero ? 22 : 18} color="tertiary" />
    </TouchableBox>
  )
}

export default NewTabItem
