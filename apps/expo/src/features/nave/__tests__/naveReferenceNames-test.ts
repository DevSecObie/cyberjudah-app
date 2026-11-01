import { localizeNaveReferences } from '../naveReferenceNames'

describe('localizeNaveReferences', () => {
  const html =
    '<a href="v=1-40-20">Genèse 40:20</a>; <a href="v=9-9-22">1 Samuel 9:22</a>; <a href="v=42-14-8,9,10">Luc 14:8-10</a>'

  it('names the books in English in the English Nave', () => {
    expect(localizeNaveReferences(html, 'en')).toBe(
      '<a href="v=1-40-20">Genesis 40:20</a>; <a href="v=9-9-22">1 Samuel 9:22</a>; <a href="v=42-14-8,9,10">Luke 14:8-10</a>'
    )
  })

  it('leaves the French Nave as it is', () => {
    expect(localizeNaveReferences(html, 'fr')).toBe(html)
  })
})
