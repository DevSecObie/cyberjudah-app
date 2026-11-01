import type { router as expoRouter } from 'expo-router'
import { navigateWithPageTransition } from './pageTransition'

// A back press is queued and only lands after the next render, so a second tap in that time still
// sees the old history and would pop a screen that is no longer there. Ignore it.
const BACK_SETTLE_MS = 500
let backPending = false

/** Direct links have no route to pop. Replace them rather than adding a return loop. */
export const goBackOrHome = (
  router: Pick<typeof expoRouter, 'canGoBack' | 'back' | 'replace'>,
  previousPath = ''
) => {
  if (backPending) return
  backPending = true
  setTimeout(() => {
    backPending = false
  }, BACK_SETTLE_MS)
  const canGoBack = router.canGoBack()
  navigateWithPageTransition(
    canGoBack ? previousPath : '/',
    () => (canGoBack ? router.back() : router.replace('/')),
    'back'
  )
}
