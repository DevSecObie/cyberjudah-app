import { Asset } from 'expo-asset'
import * as FileSystem from 'expo-file-system/legacy'
import { getEvents as getNativeEvents } from '../events'
import { getEvents as getWebEvents } from '../events.web'

jest.mock('expo-asset', () => ({ Asset: { loadAsync: jest.fn() } }))
jest.mock('expo-file-system/legacy', () => ({ readAsStringAsync: jest.fn() }))

it('does not read the original bundled timeline on web or devices in the CyberJudah profile', async () => {
  const originalProfile = process.env.EXPO_PUBLIC_RESOURCE_PROFILE
  process.env.EXPO_PUBLIC_RESOURCE_PROFILE = 'cyberjudah'
  const fetcher = jest.spyOn(globalThis, 'fetch')
  try {
    await expect(getNativeEvents()).resolves.toEqual([])
    await expect(getWebEvents()).resolves.toEqual([])
    expect(Asset.loadAsync).not.toHaveBeenCalled()
    expect(FileSystem.readAsStringAsync).not.toHaveBeenCalled()
    expect(fetcher).not.toHaveBeenCalled()
  } finally {
    fetcher.mockRestore()
    if (originalProfile === undefined) delete process.env.EXPO_PUBLIC_RESOURCE_PROFILE
    else process.env.EXPO_PUBLIC_RESOURCE_PROFILE = originalProfile
  }
})
