import { getSimpleStrongModuleId } from '@bible-strong/resource-domain/strong-lexicon'

import type { ResourceLanguage } from '~helpers/databaseTypes'
import { MOBILE_RESOURCE_CATALOG } from '~helpers/mobileResourceCatalog'
import { createOfflineCopyId } from '~helpers/offlineCopyId'
import type { StrongLexiconModuleId } from '~helpers/strongLexiconPublications'
import type { OfflineResourceRegistrySnapshot } from './resourceAvailability'

/**
 * The Strong lexicon to acquire with a Strong Bible index: the simple lexicon in the reader's
 * Strong language, unless a lexicon able to open a Strong entry is already installed.
 */
export const getStrongIndexLexiconModuleId = (
  registry: OfflineResourceRegistrySnapshot,
  language: ResourceLanguage
): StrongLexiconModuleId | undefined => {
  const isInstalled = (moduleId: StrongLexiconModuleId) =>
    registry.resources.get(createOfflineCopyId({ kind: 'strong-lexicon-module', moduleId }))
      ?.availability.status === 'available'
  const simpleModuleId = getSimpleStrongModuleId(language)
  // A catalog that publishes no simple lexicon (CyberJudah's) has none to pair with the index:
  // the Strong index still downloads, and Strong entries are read online.
  const isPublished =
    !!MOBILE_RESOURCE_CATALOG.resources[
      createOfflineCopyId({ kind: 'strong-lexicon-module', moduleId: simpleModuleId })
    ]
  return !isPublished || isInstalled(simpleModuleId) || isInstalled('core')
    ? undefined
    : simpleModuleId
}
