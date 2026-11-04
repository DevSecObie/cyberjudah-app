import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Linking, Platform } from 'react-native'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Card from '~common/ui/Card'
import { FeatherIcon } from '~common/ui/Icon'
import Switch from '~common/ui/Switch'
import Text from '~common/ui/Text'
import {
  disableNewClassAlerts,
  enableNewClassAlerts,
  newClassAlertsAvailable,
  readNewClassAlertsChoice,
  type NewClassAlertsResult,
} from './newClassAlerts'

const LABEL = 'New class alerts'

/**
 * The reader's switch for alerts when a class is posted or goes live, laid out like the
 * reading reminder's switch (ReminderSettings). Off until the reader turns it on; the system
 * asks for permission only then. Hidden on the web and on builds without push.
 */
const NewClassAlertsCard = ({ className }: { className?: string }) => {
  const [enabled, setEnabled] = useState(readNewClassAlertsChoice)
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<NewClassAlertsResult>()
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  if (Platform.OS === 'web' || !newClassAlertsAvailable()) return null

  const toggle = async (next: boolean) => {
    setPending(true)
    const outcome = next ? await enableNewClassAlerts() : await disableNewClassAlerts()
    if (!mounted.current) return
    setPending(false)
    setResult(outcome)
    setEnabled(outcome === 'on' ? true : outcome === 'off' ? false : readNewClassAlertsChoice())
  }

  return (
    <Card className={`p-[16px] gap-[12px] ${className ?? ''}`}>
      <Box className="flex-row items-center justify-between gap-[16px]">
        <Box className="flex-1 flex-row items-center gap-[8px]">
          <FeatherIcon name="bell" size={18} color="primary" />
          <Text className="text-default font-bold flex-1">{LABEL}</Text>
        </Box>
        <Switch
          disabled={pending}
          value={enabled}
          accessibilityLabel={LABEL}
          onValueChange={toggle}
        />
      </Box>
      {pending && <ActivityIndicator accessibilityLabel="Loading" />}
      {result !== 'denied' && result !== 'error' && (
        <Text className="text-grey text-[13px] leading-[20px]">
          Get an alert when a new class is posted or goes live.
        </Text>
      )}
      {result === 'denied' && (
        <Box className="gap-[8px]">
          <Text accessibilityRole="alert" className="text-default text-[13px] leading-[20px]">
            Notifications are turned off for CyberJudah. Turn them on in Settings to get alerts.
          </Text>
          <Link
            onPress={() => {
              void Linking.openSettings()
            }}
            className="min-h-[44px] justify-center"
          >
            <Text className="text-link font-bold">Open Settings</Text>
          </Link>
        </Box>
      )}
      {result === 'error' && (
        <Text accessibilityRole="alert" className="text-default text-[13px] leading-[20px]">
          Alerts could not be changed. Check your connection and try again.
        </Text>
      )}
    </Card>
  )
}

export default NewClassAlertsCard
