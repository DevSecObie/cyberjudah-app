import catalog from '../assets/cyberjudah/offline-catalog.json'
import { resolveMobileResourceArtifactUrl } from './mobileResourceCatalog'

/** Only these hash-pinned public CyberJudah archives, from the configured server, skip upstream App Check. */
export const isCyberJudahPublicArchive = (url: string, sha256: string): boolean => {
  if (process.env.EXPO_PUBLIC_RESOURCE_PROFILE !== 'cyberjudah') return false
  return Object.values(catalog.resources).some(
    entry => entry.archiveSha256 === sha256 && resolveMobileResourceArtifactUrl(entry) === url
  )
}
