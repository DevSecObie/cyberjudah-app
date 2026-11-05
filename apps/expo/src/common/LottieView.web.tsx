import { type ComponentProps, lazy, Suspense } from 'react'
import type LottieReactNative from 'lottie-react-native'

// The web player (dotLottie, about 0.5 MB) loads only when an animation is first shown.
const Lottie = lazy(() => import('lottie-react-native'))

type Props = ComponentProps<typeof LottieReactNative>

export default function LottieView(props: Props) {
  return (
    <Suspense fallback={null}>
      <Lottie {...props} />
    </Suspense>
  )
}
