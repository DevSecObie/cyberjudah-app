import type { TFunction } from 'i18next'

const IS_CYBERJUDAH = process.env.EXPO_PUBLIC_RESOURCE_PROFILE === 'cyberjudah'

/**
 * The line under a folder: Bible Strong counts the selections; the CyberJudah build shows no
 * counts on screen, only whether something in the folder is chosen.
 */
export const getOfflineSetupFolderSubtitle = (t: TFunction, count: number): string =>
  IS_CYBERJUDAH
    ? t(count > 0 ? 'offlineSetup.folderChosen' : 'offlineSetup.folderNotChosen')
    : t('offlineSetup.selectedCount', { count })

/** The review line of a folder: its selections and size, or only its size without counts. */
export const getOfflineSetupFolderReviewSummary = (
  t: TFunction,
  count: number,
  size: string
): string => (IS_CYBERJUDAH ? size : t('offlineSetup.folderReviewSummary', { count, size }))

/** A folder's description, in the CyberJudah wording where its resources differ. */
export const getOfflineSetupFolderDescription = (t: TFunction, folderId: string): string =>
  IS_CYBERJUDAH && folderId === 'original-languages'
    ? t('offlineSetup.presets.original-languages.descriptionCyberJudah')
    : t(`offlineSetup.presets.${folderId}.description`)
