// The CyberJudah build shows whether a folder has something chosen, never how many.
const t = ((key: string, options?: { count?: number; size?: string }) =>
  options ? `${key}:${JSON.stringify(options)}` : key) as never

const load = (profile: string) => {
  process.env.EXPO_PUBLIC_RESOURCE_PROFILE = profile
  let copy: typeof import('../offlineSetupCopy') | undefined
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    copy = require('../offlineSetupCopy')
  })
  return copy!
}

describe('offline setup copy', () => {
  const profile = process.env.EXPO_PUBLIC_RESOURCE_PROFILE
  afterEach(() => {
    if (profile === undefined) delete process.env.EXPO_PUBLIC_RESOURCE_PROFILE
    else process.env.EXPO_PUBLIC_RESOURCE_PROFILE = profile
  })

  it('shows no counts in the CyberJudah build', () => {
    const copy = load('cyberjudah')
    expect(copy.getOfflineSetupFolderSubtitle(t, 3)).toBe('offlineSetup.folderChosen')
    expect(copy.getOfflineSetupFolderSubtitle(t, 0)).toBe('offlineSetup.folderNotChosen')
    expect(copy.getOfflineSetupFolderReviewSummary(t, 3, '12 MB')).toBe('12 MB')
    expect(copy.getOfflineSetupFolderDescription(t, 'original-languages')).toBe(
      'offlineSetup.presets.original-languages.descriptionCyberJudah'
    )
  })

  it('keeps Bible Strong’s counts and descriptions', () => {
    const copy = load('')
    expect(copy.getOfflineSetupFolderSubtitle(t, 3)).toBe('offlineSetup.selectedCount:{"count":3}')
    expect(copy.getOfflineSetupFolderDescription(t, 'original-languages')).toBe(
      'offlineSetup.presets.original-languages.description'
    )
  })
})
