import LegalScreen from '~features/legal/LegalScreen'
import { termsOfUse } from '~features/legal/cyberJudahLegal'

export default function TermsRoute() {
  return <LegalScreen page={termsOfUse} />
}
