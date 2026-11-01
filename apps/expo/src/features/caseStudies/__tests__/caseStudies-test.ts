import { caseSections, caseSlugOf, type CaseIndex } from '../caseStudies'

const index: CaseIndex = {
  eras: ['Primeval', 'Patriarchal', 'Egypt'],
  verdicts: {},
  cases: [
    {
      slug: 'adam-and-eve',
      name: 'Adam and Eve',
      era: 'Primeval',
      kind: 'judgment',
      charge: 'Hearkening to the serpent',
      verdict: 'curse',
      url: '/cases/01-primeval/adam-and-eve',
      code: 'C001',
    },
    {
      slug: 'noah',
      name: 'Noah',
      era: 'Primeval',
      kind: 'blessing',
      charge: 'Walked with God',
      verdict: 'saved',
      url: '/cases/01-primeval/noah',
    },
    {
      slug: 'joseph',
      name: 'Joseph',
      era: 'Egypt',
      kind: 'blessing',
      charge: 'Fled fornication',
      verdict: 'exalted',
      url: '/cases/03-egypt/joseph',
    },
  ],
}

describe('case studies', () => {
  it('files the cases under their eras in order, leaving out empty eras', () => {
    expect(caseSections(index, {}).map(section => [section.title, section.data.length])).toEqual([
      ['Primeval', 2],
      ['Egypt', 1],
    ])
  })
  it('searches names, charges, verdicts and codes, and narrows by kind and era', () => {
    expect(caseSections(index, { query: 'serpent' })[0].data[0].slug).toBe('adam-and-eve')
    expect(caseSections(index, { query: 'c001' })[0].data[0].slug).toBe('adam-and-eve')
    expect(caseSections(index, { kind: 'blessing', era: 'Egypt' })[0].data[0].slug).toBe('joseph')
  })
  it('reads a case slug from its site address', () => {
    expect(caseSlugOf('/cases/01-primeval/adam-and-eve')).toBe('adam-and-eve')
    expect(caseSlugOf('/law/1a')).toBeUndefined()
  })
})
