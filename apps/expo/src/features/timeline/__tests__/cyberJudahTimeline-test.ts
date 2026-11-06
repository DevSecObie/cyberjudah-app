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

it('bundles Abraham’s corrected lifespan consistently with the other published anchors', () => {
  const events = sections.flatMap(section => section.events)
  const abrahams = events.filter(event => event.slug === 'abraham')
  expect(abrahams.length).toBeGreaterThan(0)
  for (const event of abrahams) {
    expect(event.start).toBe(-1946)
    expect(event.end - event.start).toBe(175)
    expect(events.find(row => row.slug === 'ishmael')!.start - event.start).toBe(86)
    expect(
      events.find(row => row.slug === 'abram-called-and-departs-haran')!.start - event.start
    ).toBe(75)
    expect(events.find(row => row.slug === 'sarah')!.start - event.start).toBe(10)
  }
})

it('labels the dated Lamech as Noah’s father in every bundled period', () => {
  const lamechs = sections.flatMap(section => section.events.filter(event => event.id === 673))
  expect(lamechs).toHaveLength(2)
  for (const event of lamechs) {
    expect(event.title).toBe('Lamech, father of Noah')
    expect(event.titleEn).toBe('Lamech, father of Noah')
    expect(event.end - event.start).toBe(777)
  }
})

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
