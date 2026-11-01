import { useAtomValue, useSetAtom } from 'jotai/react'
import { useEffect, useRef, useState } from 'react'
import { Modal } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useDispatch } from 'react-redux'
import Box from '~common/ui/Box'
import { getDefaultBibleVersion } from '~helpers/languageUtils'
import { isOnboardingForced } from '~helpers/runtimeConfig'
import useLanguage from '~helpers/useLanguage'
import { setDefaultBibleVersion } from '~redux/modules/user'
import { isOnboardingCompletedAtom } from './atom'
import AbelOnboarding from './AbelOnboarding'
import CyberJudahTour from './CyberJudahTour'
import SelectResources from './SelectResources'
import ResourceSetupChoice from './ResourceSetupChoice'

const IS_CYBERJUDAH = process.env.EXPO_PUBLIC_RESOURCE_PROFILE === 'cyberjudah'
const useOptionalOnboarding = () => {
  const lang = useLanguage()
  const dispatch = useDispatch()
  const isOnboardingCompleted = useAtomValue(isOnboardingCompletedAtom)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const forcedOnboardingDismissed = useRef(false)

  useEffect(() => {
    if (isOnboardingForced) {
      if (!forcedOnboardingDismissed.current) {
        console.log('[Onboarding] Force onboarding.')
        setShowOnboarding(true)
      }
      return
    }

    if (isOnboardingCompleted) {
      setShowOnboarding(false)
      return
    }

    const defaultVersion = getDefaultBibleVersion(lang)
    dispatch(setDefaultBibleVersion(defaultVersion, { localOnly: true }))
    setShowOnboarding(true)
  }, [lang, dispatch, isOnboardingCompleted])

  const hideOnboarding = () => {
    forcedOnboardingDismissed.current = true
    setShowOnboarding(false)
  }

  return { hideOnboarding, showOnboarding }
}

const OnBoarding = () => {
  const [step, setStep] = useState<'abel' | 'tour' | 'choice' | 'resources'>('abel')
  const setIsOnboardingCompleted = useSetAtom(isOnboardingCompletedAtom)
  const { hideOnboarding, showOnboarding } = useOptionalOnboarding()

  const completeOnboarding = () => {
    if (isOnboardingForced) {
      hideOnboarding()
      return
    }
    setIsOnboardingCompleted(true)
  }

  return (
    <Modal
      visible={showOnboarding}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={completeOnboarding}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Box
          className="overflow-hidden border-continuous flex-[1] bg-reverse"
          accessibilityViewIsModal
          onAccessibilityEscape={completeOnboarding}
        >
          {/* Bible Strong's tour comes first, then CyberJudah's own tour is added after it. */}
          {step === 'abel' ? (
            <AbelOnboarding onComplete={() => setStep(IS_CYBERJUDAH ? 'tour' : 'choice')} />
          ) : step === 'tour' ? (
            <CyberJudahTour onComplete={() => setStep('choice')} />
          ) : step === 'choice' ? (
            <ResourceSetupChoice
              onContinueOnline={completeOnboarding}
              onPrepareOffline={() => setStep('resources')}
            />
          ) : (
            <SelectResources onComplete={completeOnboarding} />
          )}
        </Box>
      </GestureHandlerRootView>
    </Modal>
  )
}

export default OnBoarding
