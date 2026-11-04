import { useAtomValue, useSetAtom } from 'jotai/react'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { Platform } from 'react-native'

import { downloadManager } from '~helpers/downloadManager'
import { bibleDomRemountSignalAtom } from '~state/app'
import { downloadItemStatesAtom } from '~state/downloadQueue'
import { offlineResourceRegistry } from '~features/resources/resourceAvailability'
import {
  downloadClassIndex,
  refreshClassIndexState,
  useClassIndexState,
} from '~features/passageMediaLibrary/classLibraryIndex'
import { selectedResourcesAtom } from './atom'
import {
  createDownloadItemsFromOnboardingSelections,
  getOnboardingResourceSelectionId,
} from './onboardingResources'
import { OFFLINE_SETUP_MOTION } from './offlineSetupMotion'
import { getOfflineSetupDownloadTracking } from './offlineSetupDownloadTracking'
import { getPreviewDownloadProgress } from './offlineSetupPreviewDownload'
import { getOfflineSetupSuccessTimeline } from './offlineSetupSuccessTimeline'

export type OfflineSetupDownloadPhase = 'downloading' | 'success' | 'error'
export type OfflineSetupSuccessMessage = 'ready' | 'welcome' | undefined

type Timer = ReturnType<typeof setTimeout>

const getDisplayedProgress = ({
  isPreview,
  previewProgress,
  queueProgress,
  queueTotal,
}: {
  isPreview: boolean
  previewProgress: number
  queueProgress: number
  queueTotal: number
}) => {
  if (isPreview) return previewProgress
  if (queueTotal > 0) return queueProgress
  return 0
}

type ClassLibraryPhase = 'none' | 'downloading' | 'done' | 'failed'

const toError = (reason: unknown) => {
  if (reason instanceof Error) return reason
  return new Error(String(reason))
}

const useOfflineSetupDownload = ({
  mode,
  onComplete,
  reduceMotion,
}: {
  mode: 'onboarding' | 'preview'
  onComplete?: () => void
  reduceMotion: boolean
}) => {
  const selectedResources = useAtomValue(selectedResourcesAtom)
  const bumpBibleDomRemountSignal = useSetAtom(bibleDomRemountSignalAtom)
  const downloadItemStates = useAtomValue(downloadItemStatesAtom)
  const [phase, setPhase] = useState<OfflineSetupDownloadPhase>('downloading')
  const [error, setError] = useState<Error | null>(null)
  const [previewProgress, setPreviewProgress] = useState(0)
  const [closing, setClosing] = useState(false)
  const [successMessage, setSuccessMessage] = useState<OfflineSetupSuccessMessage>('ready')
  const [trackingStarted, setTrackingStarted] = useState(false)
  const [plannedItems] = useState(() =>
    createDownloadItemsFromOnboardingSelections(selectedResources).filter(item => {
      const installed = offlineResourceRegistry.get(item.id)
      return installed?.availability.status !== 'available' || installed.updateAvailable
    })
  )
  const trackedItemIds = plannedItems.map(item => item.id)
  // The class library has its own download, beside the queue, tracked as one more item.
  const [classLibrarySelected] = useState(() =>
    selectedResources.some(resource => resource.kind === 'class-library')
  )
  const [classLibraryPhase, setClassLibraryPhase] = useState<ClassLibraryPhase>('none')
  const classIndexState = useClassIndexState()
  const timers = useRef<Set<Timer>>(new Set())
  const previewInterval = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const verificationStarted = useRef(false)
  const finished = useRef(false)
  const isPreview = mode === 'preview'
  const queueTracking = getOfflineSetupDownloadTracking(trackedItemIds, downloadItemStates)
  let classLibraryProgress = 0
  if (classLibraryPhase === 'done') classLibraryProgress = 1
  else if (classIndexState.status === 'downloading') classLibraryProgress = classIndexState.progress
  const classLibraryTracked = classLibrarySelected && !isPreview
  const trackedTotal = trackedItemIds.length + (classLibraryTracked ? 1 : 0)
  const tracking = {
    completed: queueTracking.completed && (!classLibraryTracked || classLibraryPhase === 'done'),
    failedItem: queueTracking.failedItem,
    progress:
      trackedTotal === 0
        ? 1
        : (queueTracking.progress * trackedItemIds.length +
            (classLibraryTracked ? classLibraryProgress : 0)) /
          trackedTotal,
  }
  const displayProgress = getDisplayedProgress({
    isPreview,
    previewProgress,
    queueProgress: tracking.progress,
    queueTotal: trackedTotal,
  })
  const schedule = (action: () => void, delay: number) => {
    const timer = setTimeout(() => {
      timers.current.delete(timer)
      action()
    }, delay)
    timers.current.add(timer)
  }

  const finish = () => {
    if (finished.current) return
    finished.current = true
    setPhase('success')
    const timeline = getOfflineSetupSuccessTimeline(reduceMotion)
    schedule(() => setSuccessMessage(undefined), timeline.readyEndsAt)
    schedule(() => setSuccessMessage('welcome'), timeline.welcomeStartsAt)
    schedule(() => setClosing(true), timeline.fadeOutStartsAt)
    if (!isPreview && onComplete) schedule(onComplete, timeline.completesAt)
  }

  const fail = (reason: unknown) => {
    setError(toError(reason))
    setPhase('error')
  }

  const startClassLibraryDownload = () => {
    setClassLibraryPhase('downloading')
    void downloadClassIndex()
      .then(() => refreshClassIndexState())
      .then(current => setClassLibraryPhase(current.status === 'ready' ? 'done' : 'failed'))
      .catch(() => setClassLibraryPhase('failed'))
  }

  const enqueueSelectedResources = () => {
    if (plannedItems.length > 0) downloadManager.enqueue(plannedItems)
    if (classLibrarySelected) startClassLibraryDownload()
    return plannedItems.length + (classLibrarySelected ? 1 : 0)
  }

  const retry = () => {
    try {
      verificationStarted.current = false
      setError(null)
      setPhase('downloading')
      const failedItemIds = trackedItemIds.filter(
        itemId => downloadItemStates.get(itemId)?.status === 'failed'
      )
      const classLibraryFailed = classLibraryPhase === 'failed'
      if (classLibraryFailed) startClassLibraryDownload()
      if (failedItemIds.length > 0) {
        failedItemIds.forEach(itemId => downloadManager.retry(itemId))
        return
      }
      if (classLibraryFailed) return

      if (enqueueSelectedResources() === 0) void verifyAndComplete()
    } catch (itemError) {
      fail(itemError)
    }
  }

  const verifyAndComplete = async () => {
    if (verificationStarted.current) return
    verificationStarted.current = true

    try {
      downloadManager.clearCompleted()
      if (Platform.OS === 'android') {
        bumpBibleDomRemountSignal(signal => signal + 1)
      }
      finish()
    } catch (verificationError) {
      verificationStarted.current = false
      fail(verificationError)
    }
  }

  // Resources are intentionally captured once when the download scene mounts.
  const startDownload = useEffectEvent(() => {
    if (isPreview) {
      const startedAt = Date.now()
      previewInterval.current = setInterval(() => {
        setPreviewProgress(getPreviewDownloadProgress(Date.now() - startedAt))
      }, OFFLINE_SETUP_MOTION.download.preview.progressTick)
      return () => {
        if (previewInterval.current) clearInterval(previewInterval.current)
      }
    }

    try {
      if (enqueueSelectedResources() > 0) {
        setTrackingStarted(true)
      } else {
        setTrackingStarted(true)
        void verifyAndComplete()
      }
    } catch (itemError) {
      console.error(
        `Failed to create onboarding download item ${selectedResources
          .map(getOnboardingResourceSelectionId)
          .join(', ')}:`,
        itemError
      )
      fail(itemError)
    }
    return undefined
  })

  useEffect(() => startDownload(), [])

  const finishPreview = useEffectEvent(() => finish())

  useEffect(() => {
    if (!isPreview || previewProgress < 1 || phase !== 'downloading') return
    if (previewInterval.current) clearInterval(previewInterval.current)
    finishPreview()
  }, [isPreview, phase, previewProgress])

  const completeTrackedDownload = useEffectEvent(() => void verifyAndComplete())

  useEffect(() => {
    if (isPreview || !trackingStarted || phase !== 'downloading' || !tracking.completed) return
    completeTrackedDownload()
  }, [isPreview, phase, tracking.completed, trackingStarted])

  useEffect(() => {
    if (isPreview || !trackingStarted || !tracking.failedItem) return
    fail(new Error(tracking.failedItem.error || 'Download failed'))
  }, [isPreview, tracking.failedItem, trackingStarted])

  useEffect(() => {
    if (isPreview || !trackingStarted || classLibraryPhase !== 'failed') return
    fail(new Error('The classes download failed'))
  }, [isPreview, classLibraryPhase, trackingStarted])

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout)
      timers.current.clear()
      if (previewInterval.current) clearInterval(previewInterval.current)
    },
    []
  )

  return { closing, displayProgress, error, phase, retry, successMessage }
}

export default useOfflineSetupDownload
