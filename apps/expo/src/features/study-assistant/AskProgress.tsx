import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable } from 'react-native'
import Box, { HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { useTheme } from '~themes/ThemeProvider'
import { spinnerLine } from './cyberJudahSpinner'

/** Ported from Telegram Ask's Waiting and Research components. The rotating lines are the
 * owner's original wording; the expandable rows come only from real server activity. */
export default function AskProgress({
  question,
  steps,
  live,
  waiting,
  status,
}: {
  question: string
  steps: string[]
  live: boolean
  waiting: boolean
  status: string
}) {
  const { colors } = useTheme()
  const [tick, setTick] = useState(0)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!waiting) return
    const timer = setInterval(() => setTick(n => n + 1), 2800)
    return () => clearInterval(timer)
  }, [waiting])
  const searches = steps.filter(s => s.startsWith('Searching')).length
  const readings = steps.filter(s => s.startsWith('Reading')).length
  const lookups = steps.filter(s => s.startsWith('Looking')).length
  const n = (count: number, one: string, many: string) =>
    count ? `${count} ${count > 1 ? many : one}` : ''
  const summary = live
    ? steps.at(-1)
    : [
        n(searches, 'search', 'searches'),
        n(readings, 'reading', 'readings'),
        n(lookups, 'look-up in the app', 'look-ups in the app'),
      ]
        .filter(Boolean)
        .join(' · ')
  return (
    <Box className="mb-3 gap-3">
      {!!steps.length && (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            onPress={() => setOpen(value => !value)}
            className="flex-row items-center gap-2 py-2"
          >
            <FeatherIcon name="search" size={14} color="grey" />
            <Text className="flex-1 text-xs text-grey">
              {live ? `${summary}…` : `Researched: ${summary}`}
            </Text>
            <FeatherIcon name={open ? 'chevron-up' : 'chevron-down'} size={14} color="grey" />
          </Pressable>
          {open && (
            <Box className="ml-2 gap-3 border-l border-border py-1 pl-4">
              {steps.map((step, index) => (
                <Text key={index} className="text-xs leading-5 text-grey">
                  {step}
                </Text>
              ))}
            </Box>
          )}
        </>
      )}
      {waiting && (
        <HStack className="items-center gap-3">
          <ActivityIndicator size="small" color={colors.grey} />
          <Text className="flex-1 text-sm text-grey" accessibilityLiveRegion="polite">
            {status === 'Still answering' ? 'Still answering' : spinnerLine(question, tick)}…
          </Text>
        </HStack>
      )}
    </Box>
  )
}
