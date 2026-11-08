import { isStandaloneStrongModule } from '@bible-strong/resource-domain/strong-lexicon'
import { getMobileResourceCatalogEntry } from './mobileResourceCatalog'
import type { StrongLexiconModuleId } from './strongLexiconPublications'

export const requiresStrongLexiconCore = (moduleId: StrongLexiconModuleId): boolean => {
  if (moduleId !== 'entities' && moduleId !== 'resources')
    return !isStandaloneStrongModule(moduleId)
  const artifact = getMobileResourceCatalogEntry(`strong-lexicon:${moduleId}`)
  const ownedIndependent =
    (moduleId === 'entities' || moduleId === 'resources') &&
    artifact.resourceRevision?.startsWith('cj-') &&
    !artifact.coreRevision
  return !isStandaloneStrongModule(moduleId) && !ownedIndependent
}
