import { studySourceRoute, studyDestinations } from '../askStudyNavigation'
const source = (url: string) => ({ n: 1, kind: 'reference', title: 'Abraham', url })
it.each([
  [
    '/person/abraham-gen-11-26',
    '/strong/entity/[uniqueName]',
    { uniqueName: 'abraham-gen-11-26', language: 'en' },
  ],
  [
    '/timeline/event/abraham',
    '/(explore)/timeline/[language]/[slug]',
    { language: 'en', slug: 'abraham' },
  ],
  ['/strongs/H430', '/strong/[code]', { code: 'H430', language: 'en' }],
  ['/law/2A', '/(explore)/law-section', { id: '2A' }],
])('opens %s at the exact native resource', (url, pathname, params) => {
  expect(studySourceRoute(source(url as string))).toEqual({ pathname, params })
})
it('opens original dictionary and Nave resources without relabelling them as CyberJudah content', () => {
  expect(studySourceRoute(source('/dictionary/en/easton-webster/72/entry'))).toBe(
    '/dictionary/en/easton-webster/72/abraham'
  )
  expect(studySourceRoute(source('/nave/en/abraham'))).toBe('/nave/en/abraham')
})
it('does not interpret an external or malformed URL as a native entry, or expose billing actions', () => {
  for (const url of [
    'https://cyberjudah.io.evil.test/person/abraham',
    '//evil.test/person/abraham',
    '/person/../settings',
    '/dictionary/en/x/NaN/a',
    '/nave/en/%XX',
  ])
    expect(studySourceRoute(source(url))).toBeUndefined()
  expect(Object.keys(studyDestinations)).not.toContain('billing')
})
