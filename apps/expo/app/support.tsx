import LegalScreen from '~features/legal/LegalScreen'
import { supportPage } from '~features/legal/cyberJudahLegal'
import SupportScreen from '~features/settings/SupportScreen'

const isCyberJudah = process.env.EXPO_PUBLIC_RESOURCE_PROFILE === 'cyberjudah'

export default function SupportRoute() {
  return isCyberJudah ? <LegalScreen page={supportPage} /> : <SupportScreen />
}
