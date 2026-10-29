/* eslint-disable import/first */

const mockStore = new Map<string, string>()
jest.mock('~helpers/storage', () => ({
  storage: {
    getString: (key: string) => mockStore.get(key),
    set: (key: string, value: string) => mockStore.set(key, value),
  },
}))

import {
  publishedNotePathOf,
  studyNoteHeading,
  studySections,
  toStudyNotes,
} from '../publishedNotes'

const index = [
  {
    kind: 'study',
    title: 'Genesis 2: Eden',
    url: '/study/genesis/2',
    book: 'Genesis',
    chapters: [2, 2],
    range: 'Genesis 2',
  },
  {
    kind: 'study',
    title: 'Genesis 1: The Beginning',
    url: '/study/genesis/1',
    book: 'Genesis',
    chapters: [1, 1],
    range: 'Genesis 1',
  },
  { kind: 'class', title: 'A class', url: '/classes/2026/x', videoId: 'abcdefghijk' },
  {
    kind: 'study',
    title: 'Exodus 1: Bondage',
    url: '/study/exodus/1',
    book: 'Exodus',
    chapters: [1, 1],
    range: 'Exodus 1',
  },
  { kind: 'study', title: 'Bad', url: 'javascript:alert(1)', book: 'Exodus' },
]

describe('published notes', () => {
  it('lists only study notes, a section per book with chapters in order', () => {
    const sections = studySections(toStudyNotes(index))
    expect(sections.map(s => s.title)).toEqual(['Genesis', 'Exodus'])
    expect(sections[0].data.map(n => n.url)).toEqual(['/study/genesis/1', '/study/genesis/2'])
  })

  it('searches titles and ranges', () => {
    expect(
      studySections(toStudyNotes(index), 'eden')
        .flatMap(s => s.data)
        .map(n => n.url)
    ).toEqual(['/study/genesis/2'])
  })

  it('opens study and encyclopedia links in the app, nothing else', () => {
    expect(publishedNotePathOf('https://cyberjudah.io/study/genesis/1')).toBe('/study/genesis/1')
    expect(publishedNotePathOf('https://cyberjudah.io/encyclopedia/sabbath#x')).toBe(
      '/encyclopedia/sabbath'
    )
    expect(publishedNotePathOf('https://cyberjudah.io/classes/2026/x')).toBeNull()
    expect(studyNoteHeading('Genesis 1: The Beginning')).toBe('The Beginning')
  })
})
