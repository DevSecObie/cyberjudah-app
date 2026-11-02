import { classMomentOf, firstClassMomentIn } from '../commentaryClassMoment'

describe('commentary class moments', () => {
  it('reads the class video and second from an entry timestamp', () => {
    expect(classMomentOf('https://www.youtube.com/watch?v=Oas2Tg98VMA&t=5720s')).toEqual({
      videoId: 'Oas2Tg98VMA',
      start: 5720,
    })
  })

  it('finds the moment in the entry markup, where the link is escaped', () => {
    const html =
      '<p>text</p><p><a href="https://cyberjudah.io/notes/x">Class</a> · 2026-01-03 · Bishop Yawasap ' +
      '<a href="https://www.youtube.com/watch?v=Oas2Tg98VMA&amp;t=5720s">1:35:20</a></p>'
    expect(firstClassMomentIn(html)).toEqual({ videoId: 'Oas2Tg98VMA', start: 5720 })
  })

  it('ignores links that are not a class moment', () => {
    expect(classMomentOf('https://cyberjudah.io/notes/x')).toBeUndefined()
  })
})
