import { getStrongEntityAvatarSource } from '~features/lexique/strongEntityAvatars'
import type { StrongEntityPresentationKind } from '~features/lexique/strongEntityPresentation'
import type { StrongLexiconChapterEntity } from '~features/resources/strongLexiconAccess'

type RasterAsset = string | { uri?: string; default?: string }

const resolveRasterAssetUri = (source: RasterAsset): string =>
  typeof source === 'string' ? source : source.uri || source.default || ''

export const getChapterEntityAvatarUri = (entity: StrongLexiconChapterEntity) => {
  const presentationKind: StrongEntityPresentationKind =
    entity.category === 'supernatural' ? 'other' : entity.category
  return resolveRasterAssetUri(
    getStrongEntityAvatarSource(presentationKind, entity.type, entity.uniqueName)
  )
}
