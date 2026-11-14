// surface-allow: Apple's switch thumb carries its own shadow; this draws that system control.
import type { SwitchProps } from 'react-native'
import { LOOK_OS } from '~helpers/lookPlatform.web'
import { useTheme } from '~themes/ThemeProvider'

/**
 * The switch of the phone the web app runs on inside Telegram, drawn as that phone's own app
 * shows it: Apple's green switch on iPhone, Material's switch in the app's colour on Android.
 */
export default function PhoneSwitch({
  value = false,
  onValueChange,
  disabled,
  accessibilityLabel,
  testID,
  trackColor,
}: SwitchProps) {
  const { colors } = useTheme()
  const ios = LOOK_OS === 'ios'
  const width = ios ? 51 : 52
  const height = ios ? 31 : 32
  // Material's thumb grows when the switch is on; Apple's keeps its size.
  const thumb = ios ? 27 : value ? 24 : 16
  const inset = (height - thumb) / 2
  // A switch that names its own colour keeps it, as it does in the phone apps.
  const onTrack =
    typeof trackColor?.true === 'string' ? trackColor.true : ios ? '#34C759' : colors.primary
  // Apple's off track is its system fill, a light grey on light pages and dark on dark ones.
  const offTrack = ios ? 'rgba(120,120,128,0.24)' : colors.reverse
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={accessibilityLabel}
      data-testid={testID}
      disabled={disabled}
      onClick={() => {
        void onValueChange?.(!value)
      }}
      style={{
        position: 'relative',
        flexShrink: 0,
        width,
        height,
        padding: 0,
        borderRadius: height / 2,
        border: ios || value ? 'none' : `2px solid ${colors.grey}`,
        boxSizing: 'border-box',
        background: value ? onTrack : offTrack,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'default' : 'pointer',
        transition: 'background-color 160ms ease',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: ios || value ? inset : inset - 2,
          left: ios || value ? inset : inset - 2,
          width: thumb,
          height: thumb,
          borderRadius: '50%',
          background: ios || value ? '#fff' : colors.grey,
          boxShadow: ios ? '0 3px 8px #0002, 0 1px 1px #0001' : 'none',
          transform: `translateX(${value ? width - thumb - inset * 2 : 0}px)`,
          transition: 'transform 160ms ease, width 160ms ease, height 160ms ease',
        }}
      />
    </button>
  )
}
