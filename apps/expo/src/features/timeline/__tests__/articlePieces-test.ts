import { articlePieces, withoutDisagreements } from '../articlePieces'

describe('articlePieces', () => {
  it('turns each class the article cites into one piece at its moment', () => {
    const article = [
      'So the Puerto Ricans did go through the slave trade: Deuteronomy 28:68 is for them too.',
      'The Israelites: The 8 Deadly Atrocities Committed Against Puerto Rico — 2017-07-29 — 49:03',
      'https://youtu.be/hgFoVF-5XxA?t=2943',
      'The caravels that carried the Indians are the ships of Deuteronomy 28:68.',
      'https://youtu.be/oqol6dUtMCA?t=4664',
    ].join('\n\n')
    expect(articlePieces(article)).toEqual([
      {
        kind: 'text',
        text: 'So the Puerto Ricans did go through the slave trade: Deuteronomy 28:68 is for them too.',
      },
      {
        kind: 'class',
        video: 'hgFoVF-5XxA',
        seconds: 2943,
        title: 'The Israelites: The 8 Deadly Atrocities Committed Against Puerto Rico',
        date: '2017-07-29',
        at: '49:03',
      },
      {
        kind: 'text',
        text: 'The caravels that carried the Indians are the ships of Deuteronomy 28:68.',
      },
      {
        kind: 'class',
        video: 'oqol6dUtMCA',
        seconds: 4664,
        title: undefined,
        date: undefined,
        at: undefined,
      },
    ])
  })
})

describe('withoutDisagreements', () => {
  it('leaves out the disagreements section and the pointer to it', () => {
    expect(
      withoutDisagreements(
        'Documented history\n\nUncertainty\n\nThe figures differ between accounts (see disagreements).\n\nWhere sources disagree\n\nThe date\n\nOne book gives 30 March.'
      )
    ).toBe('Documented history\n\nUncertainty\n\nThe figures differ between accounts.')
  })
})
