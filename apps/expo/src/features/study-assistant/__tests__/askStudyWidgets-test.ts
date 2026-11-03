import { askStudyWidgets, citedNumbers } from '../askStudyWidgets'

const source = (n: number, url: string, kind = 'reference', entity?: string) => ({
  n,
  kind,
  title: `T${n}`,
  url,
  ...(entity ? { entity } : {}),
})

describe("Bible Strong's cards in Ask", () => {
  it('reads the cited numbers from the answer and its Sources list', () => {
    expect([...citedNumbers('A fact [2]. Another [11].\nroot = StudyAnswer([Sources([4, 5])])')]).toEqual([
      2, 11, 4, 5,
    ])
  })

  it("maps cited people, places, Strong's words, Timeline events and Nave topics to cards", () => {
    const got = askStudyWidgets(
      [
        source(1, '/person/abraham-gen-11-26', 'people'),
        source(2, '/bible/genesis/45#v10', 'place', 'goshen-gen-45-10'),
        source(3, '/strongs/h430', 'strong'),
        source(4, '/timeline/event/the-exodus', 'timeline'),
      ],
      new Set([1, 2, 3, 4])
    )
    expect(got.map(w => [w.id, w.kind])).toEqual([
      ['w1', 'person_profile'],
      ['w2', 'place_profile'],
      ['w3', 'strong_entry'],
    ])
    expect(got[1]).toMatchObject({ entityKey: 'goshen-gen-45-10' })
    expect(got[2]).toMatchObject({ reference: 'H430', identityKind: 'strong' })
  })

  it('makes no card for an uncited source, a class, a commentary, or another site', () => {
    const got = askStudyWidgets(
      [
        source(1, '/person/abraham-gen-11-26', 'people'),
        source(2, '/classes/2026/passover', 'class'),
        source(3, '/classes/2026/passover', 'commentary'),
        source(4, 'https://evil.test/person/x', 'people'),
        source(5, '/nave/en/sabbath', 'nave'),
        source(6, '/timeline/event/the-exodus', 'timeline'),
      ],
      new Set([2, 3, 4, 5, 6])
    )
    expect(got.map(w => w.kind)).toEqual(['nave_topic', 'event_timeline'])
    expect(got[1]).toMatchObject({ events: ['the-exodus'] })
  })
})
