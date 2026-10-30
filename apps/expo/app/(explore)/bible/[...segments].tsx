import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'
import { Platform } from 'react-native'
import { useTranslation } from 'react-i18next'

import { BibleRouteScreen, type BibleRouteInput } from '~features/bible/BibleScreen'
import { buildPublicBiblePath, parsePublicBibleRoute } from '~features/bible/publicBibleRoutes'
import ResourceUnavailableView from '~features/resources/ResourceUnavailableView'
import { createPublicBibleNavigation } from '~features/bible/publicBibleNavigation'

const firstString = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value

const PublicBibleRoute = () => {
  const router = useRouter()
  const { t } = useTranslation()
  const params = useLocalSearchParams<{
    segments?: string | string[]
    gloss?: string | string[]
  }>()
  const glossLanguage = firstString(params.gloss)
  const route = parsePublicBibleRoute(params.segments, glossLanguage)

  if (!route) {
    // cyberjudah.io's earlier site linked chapters without a version (/bible/john/3): open them in
    // the KJV, the only Bible it published.
    const segments = Array.isArray(params.segments)
      ? params.segments
      : (params.segments?.split('/').filter(Boolean) ?? [])
    const withoutVersion = parsePublicBibleRoute(['kjv', ...segments], glossLanguage)
    if (withoutVersion) return <Redirect href={buildPublicBiblePath(withoutVersion)} />
    return (
      <ResourceUnavailableView
        title={t('Référence biblique introuvable')}
        failure={{ cause: 'not-found', recoveries: [] }}
      />
    )
  }

  const requestedSegments = Array.isArray(params.segments)
    ? params.segments
    : (params.segments?.split('/').filter(Boolean) ?? [])
  const requestedPath = `/bible/${requestedSegments.join('/')}${
    glossLanguage ? `?gloss=${glossLanguage}` : ''
  }`
  const canonicalPath = buildPublicBiblePath(route)
  if (requestedPath !== canonicalPath) return <Redirect href={canonicalPath} />
  // The address follows the reading only where it is visible. In a native sheet, a route
  // per chapter stacks a screen for each one, so the reader keeps its own state there.
  const routeNavigation =
    Platform.OS === 'web'
      ? createPublicBibleNavigation(route, {
          push: path => router.push(path),
          replace: path => router.replace(path),
        })
      : undefined

  const passage = route.passage
  const focusVerses = passage
    ? Array.from(
        { length: (passage.endVerse ?? passage.startVerse) - passage.startVerse + 1 },
        (_, index) => passage.startVerse + index
      )
    : undefined
  const strongMode: BibleRouteInput['strongMode'] =
    route.presentation === 'strong'
      ? 'visible'
      : route.presentation === 'reverse-interlinear'
        ? 'reverse-interlinear'
        : 'hidden'

  return (
    <BibleRouteScreen
      input={{
        version: route.version,
        book: route.book,
        chapter: route.chapter,
        verse: passage?.startVerse,
        focusVerses,
        contextDisplayMode: passage ? 'focused' : 'fullChapter',
        strongMode,
        interlinearMode: route.presentation === 'interlinear' ? 'interlinear' : undefined,
        interlinearLocale: route.glossLanguage,
      }}
      routeNavigation={routeNavigation}
    />
  )
}

export default PublicBibleRoute
