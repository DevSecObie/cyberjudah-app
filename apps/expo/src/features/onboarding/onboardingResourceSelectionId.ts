import { createOfflineCopyId, getOfflineCopyCatalogId } from '~helpers/offlineCopyId'
import type {
  OnboardingResourceSelection,
  QueuedOnboardingResourceSelection,
} from './onboardingResources'

export const isQueuedOnboardingResourceSelection = (
  resource: OnboardingResourceSelection
): resource is QueuedOnboardingResourceSelection => resource.kind !== 'class-library'

/** The id the download catalog publishes a selection under (dictionaries keep their old one). */
export const getOnboardingResourceCatalogId = (resource: OnboardingResourceSelection): string =>
  resource.kind === 'dictionary'
    ? getOfflineCopyCatalogId({
        kind: 'dictionary',
        work: resource.work,
        resourceId: resource.resourceId,
        language: resource.lang,
      })
    : getOnboardingResourceSelectionId(resource)

export const getOnboardingResourceSelectionId = (resource: OnboardingResourceSelection): string => {
  if (resource.kind === 'class-library') return 'class-library'
  if (resource.kind === 'bible') {
    return createOfflineCopyId({ kind: 'bible', versionId: resource.versionId })
  }
  if (resource.kind === 'bible-strong') {
    return createOfflineCopyId({
      kind: 'strong-bible-index',
      versionId: resource.versionId,
    })
  }
  if (resource.kind === 'strong-lexicon') {
    return createOfflineCopyId({
      kind: 'strong-lexicon-module',
      moduleId: resource.moduleId ?? 'core',
    })
  }
  if (resource.kind === 'bible-interlinear') {
    return createOfflineCopyId({
      kind: 'interlinear-index',
      versionId: 'BHG',
      language: resource.lang,
    })
  }
  if (resource.kind === 'commentary') {
    return createOfflineCopyId({
      kind: 'commentary',
      resourceId: resource.resourceId,
      language: resource.lang,
    })
  }
  if (resource.kind === 'dictionary') {
    return createOfflineCopyId({
      kind: 'dictionary',
      work: resource.work,
      resourceId: resource.resourceId,
      language: resource.lang,
    })
  }

  return createOfflineCopyId({
    kind: 'database',
    databaseId: resource.databaseId,
    language: resource.lang,
  })
}
