import { inBibleOrder, preceptSections, scriptureHasVerse, scriptureText } from '../preceptsAndLaw'

describe('precepts and the law', () => {
  it('files precepts A to Z and searches their titles', () => {
    const rows = [
      { slug: 'obedience', title: 'Obedience', refs: 2 },
      { slug: 'abortion', title: 'Abortion', refs: 3 },
      { slug: 'abomination', title: 'Abomination', refs: 11 },
    ]
    expect(
      preceptSections(rows).map(section => [section.title, section.data.map(row => row.slug)])
    ).toEqual([
      ['A', ['abomination', 'abortion']],
      ['O', ['obedience']],
    ])
    expect(preceptSections(rows, 'obed')).toHaveLength(1)
  })
  it('reads a passage as one text', () => {
    expect(
      scriptureText({
        label: 'Exodus 20:2-3',
        url: '/bible/exodus/20#v2',
        text: [
          { verse: 2, text: 'I am the Lord thy God.' },
          { verse: 3, text: 'Thou shalt have no other gods before me.' },
        ],
      })
    ).toBe('I am the Lord thy God. Thou shalt have no other gods before me.')
  })
  it("puts a precept's scriptures in Bible order, the Apocrypha in its KJV 1611 place", () => {
    const ref = (label: string, url: string, verse: number) => ({
      label,
      url,
      text: [{ verse, text: '' }],
    })
    expect(
      inBibleOrder([
        ref('Baruch 2:5', '/bible/baruch/2#v5', 5),
        ref('Exodus 23:22', '/bible/exodus/23#v22', 22),
        ref('Matthew 5:3', '/bible/matthew/5#v3', 3),
        ref('Exodus 20:3', '/bible/exodus/20#v3', 3),
      ]).map(scripture => scripture.label)
    ).toEqual(['Exodus 20:3', 'Exodus 23:22', 'Baruch 2:5', 'Matthew 5:3'])
  })
  it('finds the scripture holding a verse', () => {
    const scripture = {
      label: 'Exodus 20:2-3',
      url: '/bible/exodus/20#v2',
      text: [
        { verse: 2, text: '' },
        { verse: 3, text: '' },
      ],
    }
    expect(scriptureHasVerse(scripture, 'exodus/20/3')).toBe(true)
    expect(scriptureHasVerse(scripture, 'exodus/20/4')).toBe(false)
  })
})
