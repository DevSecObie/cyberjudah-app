import { chapterVerseTags, verseTagRoute } from '../verseTags'

describe('precept and law tags on verses', () => {
  it('labels the tags on a verse', () => {
    const tags = chapterVerseTags(2, 20)
    const labels = (tags[3] ?? []).map(tag => tag.label)
    expect(labels).toContain('Law 1A.1')
  })
  it('opens a precept or the section of its law', () => {
    expect(verseTagRoute('p:obedience', 'exodus/20/3')).toEqual({
      pathname: '/(explore)/precept',
      params: { slug: 'obedience', at: 'exodus/20/3' },
    })
    expect(verseTagRoute('l:1A.1')).toEqual({
      pathname: '/(explore)/law-section',
      params: { id: '1A', law: '1A.1' },
    })
  })
})
