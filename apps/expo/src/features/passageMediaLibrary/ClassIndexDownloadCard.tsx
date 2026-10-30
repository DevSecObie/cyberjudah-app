import React from 'react'
import Box, { HStack, TouchableBox, VStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import {
  CLASS_INDEX_DOWNLOAD_MB,
  downloadClassIndex,
  removeClassIndex,
  useClassIndexState,
} from './classLibraryIndex'

/**
 * The classes kept on this phone for instant search, in Downloads with the other resources: its
 * state, and download, update or remove. The app also keeps it current by itself on Wi-Fi.
 */
const ClassIndexDownloadCard = () => {
  const state = useClassIndexState()
  const busy = state.status === 'downloading'
  const description =
    state.status === 'downloading'
      ? `Downloading… ${Math.round(state.progress * 100)}%`
      : state.status === 'ready'
        ? 'On this phone. Class search runs here, in milliseconds, even offline. Kept up to date on Wi-Fi.'
        : state.status === 'failed'
          ? 'The download did not finish. Try again.'
          : `Every class, Captains and Hidden History episode, for instant search on this phone (about ${CLASS_INDEX_DOWNLOAD_MB} MB).`
  return (
    <Box className="mx-[20px] mt-[16px] rounded-[16px] bg-light-grey p-[16px]">
      <HStack className="items-center gap-[12px]">
        <FeatherIcon name="play-circle" size={22} color="primary" />
        <VStack className="flex-[1] gap-[3px]">
          <Text className="text-[16px] font-bold">The classes</Text>
          <Text className="text-grey text-[13px] leading-[18px]">{description}</Text>
        </VStack>
      </HStack>
      {!busy && (
        <HStack className="mt-[12px] gap-[16px] justify-end">
          {state.status === 'ready' && (
            <TouchableBox accessibilityRole="button" onPress={() => void removeClassIndex()}>
              <Text className="text-grey text-[14px]">Remove</Text>
            </TouchableBox>
          )}
          <TouchableBox accessibilityRole="button" onPress={() => void downloadClassIndex()}>
            <Text className="text-primary text-[14px] font-bold">
              {state.status === 'ready' ? 'Download again' : 'Download'}
            </Text>
          </TouchableBox>
        </HStack>
      )}
    </Box>
  )
}

export default ClassIndexDownloadCard
