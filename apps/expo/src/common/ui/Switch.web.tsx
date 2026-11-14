import React from 'react'
import { Switch as SwitchBase, type SwitchProps } from 'react-native'
import { IS_TELEGRAM_PHONE } from '~helpers/lookPlatform.web'
import PhoneSwitch from './PhoneSwitch.web'

// On the web the browser's switch; inside Telegram on a phone, that phone's own (PhoneSwitch).
const Switch = (props: SwitchProps) =>
  IS_TELEGRAM_PHONE ? <PhoneSwitch {...props} /> : <SwitchBase {...props} />

export default Switch
