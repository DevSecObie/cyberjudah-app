import { useEffect, useEffectEvent, useRef } from 'react'
import { useAppRating } from './useAppRating'
import { usesCyberJudahEditorial } from '~helpers/editorialProfile'

/**
 * Hook to track app opens and check for engagement-based rating triggers.
 * Should be called once at app startup (e.g., in InitHooks).
 * Returns whether the rating prompt should be shown.
 */
export function useAppRatingCheck() {
  const { trackAppOpen, shouldShowRatingPrompt } = useAppRating()
  const hasTracked = useRef(false)

  const trackFirstOpen = useEffectEvent(() => {
    if (!hasTracked.current) {
      hasTracked.current = true
      trackAppOpen()
    }
  })

  useEffect(() => {
    trackFirstOpen()
  }, [])

  return {
    // The prompt rates Bible Strong's store listing; CyberJudah has no listing of its own yet.
    shouldShowEngagementRating: () =>
      !usesCyberJudahEditorial() && shouldShowRatingPrompt('engagement_milestone'),
  }
}
