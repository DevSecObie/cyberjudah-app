import {
  preceptChipsByVerse,
  preceptVerses,
  preceptsForVerse,
  type VersePrecept,
} from '../versePrecepts'

const precept = (verses: string, teacher: string, date: string): VersePrecept => ({
  verses,
  kind: 'precept',
  ref: {
    book: 'Jeremiah',
    chapter: 1,
    verses: '4-5',
    label: 'Jeremiah 1:4-5',
    url: '/bible/jeremiah/1#v4',
  },
  text: '',
  note: { label: teacher, url: '/classes/x', date, teacher },
})

describe('verse precepts', () => {
  it('reads verse lists and ranges', () => {
    expect(preceptVerses('27-28')).toEqual([27, 28])
    expect(preceptVerses('1,26')).toEqual([1, 26])
  })
  it('shows each precept scripture once, after the first verse it was read with', () => {
    expect(
      preceptChipsByVerse([
        precept('27-28', 'a', '2026'),
        precept('27', 'b', '2026'),
        precept('1,26', 'c', '2026'),
      ])
    ).toEqual({
      27: [{ key: '27:Jeremiah 1:4-5', label: 'Jeremiah 1:4-5' }],
      1: [{ key: '1:Jeremiah 1:4-5', label: 'Jeremiah 1:4-5' }],
      26: [{ key: '26:Jeremiah 1:4-5', label: 'Jeremiah 1:4-5' }],
    })
  })
  it("lists a verse's precepts with the Bishops' and Deacons' first", () => {
    const order = preceptsForVerse(
      [
        precept('27', 'Captain Yaya', '2026-10-01'),
        precept('26-28', 'Deacon Eythan', '2026-01-01'),
        precept('27', 'Bishop Nathanyel', '2025-01-01'),
        precept('3', 'Bishop Nathanyel', '2025-01-01'),
      ],
      27
    ).map(row => row.note.teacher)
    expect(order).toEqual(['Bishop Nathanyel', 'Deacon Eythan', 'Captain Yaya'])
  })
})
