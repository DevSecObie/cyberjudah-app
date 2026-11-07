import React, { useState } from 'react'
import { ActivityIndicator, TouchableOpacity } from 'react-native'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { twMerge } from '~common/ui/classNames'
import DownloadSectionHeader from '~features/settings/components/DownloadSectionHeader'
import { DOWNLOAD_LIST_LAYOUT } from '~features/settings/components/downloadListLayout'
import { useTheme } from '~themes/ThemeProvider'
import {
  CLASS_INDEX_DOWNLOAD_MB,
  downloadClassIndex,
  removeClassIndex,
  useClassIndexState,
} from './classLibraryIndex'

/**
 * The classes kept on this phone for instant search, as one more section of the download list:
 * the same header, card and row as the Bibles and dictionaries under it. The app also keeps the
 * copy current by itself on Wi-Fi.
 */
const ClassIndexDownloadCard = () => {
  const theme = useTheme()
  const state = useClassIndexState()
  const [collapsed, setCollapsed] = useState(false)
  const downloading = state.status === 'downloading'
  const ready = state.status === 'ready'
  const progress = downloading ? Math.round(state.progress * 100) : 0
  const subtitle = downloading
    ? `Downloading… ${progress}%`
    : state.status === 'failed'
      ? 'The download did not finish. Try again.'
      : 'Class notes and search, available offline. Videos require an internet connection.'

  return (
    <Box className="mt-[16px]">
      <DownloadSectionHeader
        title="Classes"
        isCollapsed={collapsed}
        onToggleCollapse={() => setCollapsed(value => !value)}
        downloadedCount={ready ? 1 : 0}
        totalCount={1}
      />
      {collapsed ? null : (
        <Box className="border-continuous mx-[20px] mb-[22px] overflow-hidden rounded-[16px] bg-surface">
          <Box
            className="flex-row items-center"
            style={{
              paddingHorizontal: DOWNLOAD_LIST_LAYOUT.cardPaddingHorizontal,
              paddingVertical: 14,
            }}
          >
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="The classes"
              accessibilityHint={ready ? undefined : 'Downloads the classes to this phone'}
              accessibilityState={{ busy: downloading, disabled: ready || downloading }}
              disabled={ready || downloading}
              onPress={() => void downloadClassIndex()}
              activeOpacity={0.7}
              style={{ flex: 1 }}
            >
              <Box className="flex-row items-center">
                <Text
                  numberOfLines={1}
                  style={{ fontSize: 16, flexShrink: 1 }}
                  className={twMerge(ready ? 'text-link' : 'text-default')}
                >
                  The classes
                </Text>
                {ready && (
                  <Box className="ml-[5px]">
                    <FeatherIcon name="cloud" size={14} color="primary" />
                  </Box>
                )}
              </Box>
              <Text className="text-[10px] text-tertiary mt-[2px]" numberOfLines={2}>
                {subtitle}
              </Text>
              {downloading && (
                <Box className="mt-[6px] h-[4px] rounded-full bg-border overflow-hidden">
                  <Box
                    className="h-[4px] rounded-full bg-primary"
                    style={{ width: `${progress}%` }}
                  />
                </Box>
              )}
            </TouchableOpacity>
            <Box className="ml-[12px] items-end justify-center">
              {downloading ? (
                <ActivityIndicator size="small" color={theme.colors.tertiary} />
              ) : ready ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Remove the classes from this phone"
                  onPress={() => void removeClassIndex()}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={{ padding: 4 }}
                >
                  <FeatherIcon name="trash-2" size={16} color="quart" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Download the classes"
                  onPress={() => void downloadClassIndex()}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={{ padding: 4, alignItems: 'flex-end' }}
                >
                  <FeatherIcon name="download" size={18} color="primary" />
                  <Text className="text-[10px] text-tertiary mt-[2px]">
                    {CLASS_INDEX_DOWNLOAD_MB} MB
                  </Text>
                </TouchableOpacity>
              )}
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  )
}

export default ClassIndexDownloadCard
