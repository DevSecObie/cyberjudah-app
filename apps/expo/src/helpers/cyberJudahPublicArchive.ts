import catalog from '../assets/cyberjudah/offline-catalog.json'

/** Only these hash-pinned public-domain archives are exempt from upstream App Check. */
export const isCyberJudahPublicArchive = (url: string, sha256: string): boolean => {
  if (process.env.EXPO_PUBLIC_RESOURCE_PROFILE !== 'cyberjudah') return false
  return Object.values(catalog.resources).some(
    entry => entry.url === url && entry.archiveSha256 === sha256
  )
}
