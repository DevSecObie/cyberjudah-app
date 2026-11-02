import { byClassUse, dataUrl, loadBook, pageLabel, scanUrl, type LibraryRow } from '../booksData'

const row = (slug: string, classes: number, title = slug) =>
  ({ slug, title, classes }) as LibraryRow

describe('booksData', () => {
  it('lists the books the classes read most first, then A to Z', () => {
    expect(
      byClassUse([row('b', 2), row('a', 0, 'Zed'), row('c', 9), row('d', 0, 'Abel')]).map(
        b => b.slug
      )
    ).toEqual(['c', 'b', 'd', 'a'])
  })

  it('makes data-set addresses whole', () => {
    expect(dataUrl('/api/library/josephus/figures/cover.webp')).toBe(
      'https://data.cyberjudah.io/api/library/josephus/figures/cover.webp'
    )
    expect(dataUrl(null)).toBeUndefined()
  })

  it('names a page by its volume only in a work of several volumes', () => {
    expect(pageLabel({ volumes: 1 }, 1, 37)).toBe('p. 37')
    expect(pageLabel({ volumes: 12 }, 4, 246)).toBe('vol. 4, p. 246')
  })

  it('finds the printed page at the archive', () => {
    expect(
      scanUrl('https://archive.org/download/{id}/page/n{img}_w1200.jpg', 'josephus05', 44)
    ).toBe('https://archive.org/download/josephus05/page/n44_w1200.jpg')
    expect(scanUrl('', 'x', 1)).toBeUndefined()
  })

  it('refuses a book name that is not a slug', () => {
    expect(() => loadBook('../secrets')).toThrow('CYBERJUDAH_BOOK_UNKNOWN')
  })
})
