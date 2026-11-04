import LegalScreen from '~features/legal/LegalScreen'
import { privacyPolicy } from '~features/legal/cyberJudahLegal'

export default function PrivacyRoute() {
  return <LegalScreen page={privacyPolicy} />
}
