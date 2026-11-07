import { trackAnalyticsScreen } from '~helpers/analytics'
import { hideBootSplash } from '~helpers/bootSplash'
import ConfirmDialogHost from '~common/ConfirmDialog/ConfirmDialogHost.web'
import { useAtomValue } from 'jotai'
import {
  useWorkspaceRoutePanel,
  workspacePanelResizingAtom,
} from '~navigation/useWorkspaceRoutePanel'
import WorkspaceLayout from '~features/app-switcher/WorkspaceLayout'
import * as Sentry from '@sentry/react-native'
import { Stack, useLocalSearchParams, usePathname, useSegments } from 'expo-router'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { RootSiblingParent } from 'react-native-root-siblings'
import TrackPlayer from 'react-native-track-player'

import InitHooks from '~common/InitHooks'
import { SheetProvider } from '~common/sheet'
import ThemedToaster from '~common/ThemedToaster'
import { AppSwitcherProvider } from '~features/app-switcher/AppSwitcherProvider'
import { BookSelectorSheetProvider } from '~features/bible/BookSelectorSheet/BookSelectorSheetProvider'
import { StrongAudioProvider } from '~features/bible/StrongAudioProvider'
import { appLogger } from '~helpers/agentObservability'
import { createFormSheetOptions } from '~navigation/formSheetOptions'
import { usesCyberJudahEditorial } from '~helpers/editorialProfile'
import type { Theme } from '~themes/index'
import { PlaybackService } from '../../../playbackService'

// Panels that wait for the reader to act (previews, tags, colors, the class player, What's new)
// load after the first screen is up, so opening the site only fetches what that screen shows.
const AssistantLauncher = lazy(() => import('~features/study-assistant/AssistantLauncher.web'))
const WorkspaceAnalytics = lazy(() => import('~features/app-switcher/WorkspaceAnalytics.web'))
const ReferencePreviewHost = lazy(
  () => import('~features/bibleReferencePreview/ReferencePreviewHost')
)
const ChangelogModal = lazy(() => import('~common/Changelog'))
const ColorChangeModal = lazy(() => import('~common/ColorChangeModal'))
const ColorPickerModal = lazy(() => import('~common/ColorPickerModal'))
const DockedClassPlayer = lazy(() => import('~features/passageMediaLibrary/DockedClassPlayer'))
const UnifiedTagsModal = lazy(() => import('~common/UnifiedTagsModal'))

const AfterFirstScreen = ({ children }: { children: ReactNode }) => {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const idle = window.requestIdleCallback
    if (idle) {
      const id = idle(() => setShow(true), { timeout: 2000 })
      return () => window.cancelIdleCallback(id)
    }
    const id = setTimeout(() => setShow(true), 500)
    return () => clearTimeout(id)
  }, [])
  return show ? <Suspense fallback={null}>{children}</Suspense> : null
}

const NavigationTracking = () => {
  const pathname = usePathname()
  const segments = useSegments()
  const params = useLocalSearchParams()
  const previousPathname = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (previousPathname.current === pathname) return
    const screenName = segments[segments.length - 1] || 'index'
    appLogger.info('navigation', 'screen.changed', { pathname, screenName, segments })
    void trackAnalyticsScreen(segments)
    Sentry.addBreadcrumb({
      category: 'screen',
      message: `Navigated to: ${pathname}`,
      data: { pathname, segments, params: Object.keys(params).length ? params : undefined },
    })
    previousPathname.current = pathname
  }, [params, pathname, segments])

  return null
}

const FullAppRuntime = ({ theme }: { theme: Theme }) => {
  const panel = useWorkspaceRoutePanel()
  const panelResizing = useAtomValue(workspacePanelResizingAtom)
  useEffect(() => {
    void TrackPlayer.registerPlaybackService(() => PlaybackService)
  }, [])
  useEffect(() => {
    // The workspace has painted: the page's lion gives way to it.
    const frame = requestAnimationFrame(hideBootSplash)
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <AppSwitcherProvider>
      <RootSiblingParent>
        <SheetProvider>
          <BookSelectorSheetProvider>
            <StrongAudioProvider>
              <InitHooks />
              <NavigationTracking />
              <WorkspaceLayout>
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: {
                      marginRight: panel.open ? panel.reservedWidth : 0,
                      ...{
                        transitionProperty: 'margin-right',
                        transitionDuration: panelResizing ? '0ms' : '240ms',
                        transitionTimingFunction: 'cubic-bezier(0.2, 0, 0, 1)',
                      },
                    },
                  }}
                >
                  <Stack.Screen name="index" />
                  <Stack.Screen
                    name="(timeline-search)"
                    options={createFormSheetOptions(theme, { sheetAllowedDetents: [1] })}
                  />
                  <Stack.Screen
                    name="(explore)"
                    options={createFormSheetOptions(theme, { sheetAllowedDetents: [0.45, 1] })}
                  />
                  <Stack.Screen
                    name="(commentary)"
                    options={createFormSheetOptions(theme, { sheetAllowedDetents: [1] })}
                  />
                  <Stack.Screen name="(library)" />
                  <Stack.Screen
                    name="strong"
                    options={createFormSheetOptions(theme, { sheetAllowedDetents: [1] })}
                  />
                </Stack>
              </WorkspaceLayout>
              <ConfirmDialogHost />
              <ThemedToaster />
              <AfterFirstScreen>
                <WorkspaceAnalytics />
                {/* Bible Strong's own assistant stays off; CyberJudah has Ask (as on the phone). */}
                {!usesCyberJudahEditorial() && <AssistantLauncher />}
                <DockedClassPlayer />
                <ChangelogModal />
                <UnifiedTagsModal />
                <ReferencePreviewHost />
                <ColorPickerModal />
                <ColorChangeModal />
              </AfterFirstScreen>
            </StrongAudioProvider>
          </BookSelectorSheetProvider>
        </SheetProvider>
      </RootSiblingParent>
    </AppSwitcherProvider>
  )
}

export default FullAppRuntime
