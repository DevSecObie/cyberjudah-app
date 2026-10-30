import { isStandaloneStrongModule } from '@bible-strong/resource-domain/strong-lexicon'
import cyberJudahCatalog from '../assets/cyberjudah/offline-catalog.json'
import type { StrongLexiconModuleId } from './strongLexiconPublications'

type CatalogArtifact = {
  url: string
  entry: string
  archiveBytes: number
  archiveSha256: string
  contentBytes: number
  contentSha256: string
  resourceRevision?: string
}

// CyberJudah's People module is built from its own KJV catalog. It names no Strong entries, so
// it stands alone: it is never paired with Bible Strong's lexicon core.
export const cyberJudahEntitiesArtifact: CatalogArtifact | undefined =
  process.env.EXPO_PUBLIC_RESOURCE_PROFILE === 'cyberjudah'
    ? (cyberJudahCatalog.resources as Record<string, CatalogArtifact>)['strong-lexicon:entities']
    : undefined

/** Whether a lexicon module is built against, and installed after, the lexicon core. */
export const requiresStrongLexiconCore = (moduleId: StrongLexiconModuleId): boolean =>
  !isStandaloneStrongModule(moduleId) &&
  !(moduleId === 'entities' && cyberJudahEntitiesArtifact?.resourceRevision)
