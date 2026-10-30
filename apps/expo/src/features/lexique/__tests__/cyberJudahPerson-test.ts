import { howWeKnow, orderTeachings, ownPoints, verseSiteUrl } from '../cyberJudahPerson'

const teaching = (teacher: string, date: string) => ({
  verse: 'Genesis 3:20',
  url: '/bible/genesis/3#v20',
  points: [],
  note: { label: teacher, url: `/classes/${date}`, date, teacher },
})

describe('CyberJudah person page', () => {
  it('lists each stated link with its verses and without how sure it is', () => {
    const rows = howWeKnow({
      id: 'eve-gen-3-20',
      name: 'Eve',
      taught: [],
      classes: [],
      cases: [],
      partners: [{ id: 'adam-gen-2-19', name: 'Adam', verses: ['genesis/4/1'] }],
      children: [{ id: 'cain-gen-4-1', name: 'Cain', verses: ['genesis/4/1'] }],
    })
    expect(rows.map(row => `${row.label}: ${row.link.name}`)).toEqual([
      'Husband or wife: Adam',
      'Child: Cain',
    ])
    expect(JSON.stringify(rows)).not.toContain('Scripturally')
  })

  it("puts the Bishops' and Deacons' teaching first, then the newest", () => {
    const order = orderTeachings([
      teaching('Captain Yaya', '2026-10-01'),
      teaching('Deacon Eythan', '2026-01-01'),
      teaching('Bishop Nathanyel', '2025-01-01'),
    ]).map(row => row.note.teacher)
    expect(order).toEqual(['Bishop Nathanyel', 'Deacon Eythan', 'Captain Yaya'])
  })

  it('drops a point that only repeats the verse', () => {
    expect(
      ownPoints(
        ['And Adam called his wife’s name Eve', 'Eve was our foremother.'],
        'And Adam called his wife’s name Eve; because she was the mother of all living.'
      )
    ).toEqual(['Eve was our foremother.'])
  })

  it('turns data verse paths into site links', () => {
    expect(verseSiteUrl('genesis/4/1')).toBe('https://cyberjudah.io/bible/genesis/4#v1')
    expect(verseSiteUrl('/bible/genesis/3#v20')).toBe('https://cyberjudah.io/bible/genesis/3#v20')
  })
})
