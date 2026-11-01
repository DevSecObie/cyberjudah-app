import { isWikipediaUrl } from '../wikipediaLinks'

describe('isWikipediaUrl', () => {
  it('knows a Wikipedia page in any language, desktop or mobile', () => {
    expect(isWikipediaUrl('https://en.wikipedia.org/wiki/Lagos,_Portugal')).toBe(true)
    expect(isWikipediaUrl('https://en.m.wikipedia.org/wiki/Ant%C3%A3o_Gon%C3%A7alves')).toBe(true)
    expect(isWikipediaUrl('https://fr.wikipedia.org/wiki/Lagos')).toBe(true)
  })

  it('leaves every other link to the browser', () => {
    expect(isWikipediaUrl('https://www.gutenberg.org/cache/epub/35738/pg35738.txt')).toBe(false)
    expect(isWikipediaUrl('https://wikipedia.org.example.com/wiki/Lagos')).toBe(false)
    expect(isWikipediaUrl('https://notwikipedia.org/wiki/Lagos')).toBe(false)
    expect(isWikipediaUrl('javascript:alert(1)//en.wikipedia.org')).toBe(false)
    expect(isWikipediaUrl('not a link')).toBe(false)
  })
})
