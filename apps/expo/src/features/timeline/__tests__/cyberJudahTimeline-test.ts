import { Asset } from 'expo-asset'
import * as FileSystem from 'expo-file-system/legacy'
import { getEvents as getNativeEvents } from '../events'
import { getEvents as getWebEvents } from '../events.web'
import sections from '~assets/cyberjudah/timeline-sections.json'
import { calculateLabel } from '../constants'

jest.mock('expo-asset', () => ({ Asset: { loadAsync: jest.fn() } }))
jest.mock('expo-file-system/legacy', () => ({ readAsStringAsync: jest.fn() }))
jest.mock('~helpers/utils', () => ({ wp: (value: number) => value }))
jest.mock('~i18n', () => ({ getFixedT: () => (key: string) => key }))

it('uses the same published CyberJudah periods on web and devices without reading the upstream content', async () => {
  const originalProfile = process.env.EXPO_PUBLIC_RESOURCE_PROFILE
  process.env.EXPO_PUBLIC_RESOURCE_PROFILE = 'cyberjudah'
  const fetcher = jest.spyOn(globalThis, 'fetch')
  try {
    await expect(getNativeEvents()).resolves.toEqual(sections)
    await expect(getWebEvents()).resolves.toEqual(sections)
    expect(sections).toHaveLength(21)
    expect(new Set(sections.flatMap(section => section.events.map(event => event.slug))).size).toBe(
      991
    )
    expect(sections.some(section => section.sectionTitle === 'The American Captivity')).toBe(true)
    expect(Asset.loadAsync).not.toHaveBeenCalled()
    expect(FileSystem.readAsStringAsync).not.toHaveBeenCalled()
    expect(fetcher).not.toHaveBeenCalled()
    expect(calculateLabel(2016, 2016, 'en')).toBe('2016')
    expect(calculateLabel(2020, 2020, 'en')).toBe('2020')
    expect(calculateLabel(1844, 1844, 'en')).toBe('1844')
  } finally {
    fetcher.mockRestore()
    if (originalProfile === undefined) delete process.env.EXPO_PUBLIC_RESOURCE_PROFILE
    else process.env.EXPO_PUBLIC_RESOURCE_PROFILE = originalProfile
  }
})
