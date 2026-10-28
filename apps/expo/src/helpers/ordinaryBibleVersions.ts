import { ORDINARY_BIBLE_VERSION_IDS as upstreamVersions } from '@bible-strong/resource-catalog/ordinary-bibles'
export const ORDINARY_BIBLE_VERSION_IDS =
  process.env.EXPO_PUBLIC_RESOURCE_PROFILE === 'cyberjudah' ? ['KJV'] : upstreamVersions
export const ONLINE_BIBLE_VERSION_IDS = ORDINARY_BIBLE_VERSION_IDS
export const isOrdinaryBibleVersionId = (versionId: string) =>
  ORDINARY_BIBLE_VERSION_IDS.includes(versionId)
