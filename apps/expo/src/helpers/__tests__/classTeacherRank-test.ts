import { classTeacherRank } from '../classTeacherRank'

test('the Bishops in Obie’s order, then Deacons, Captains, the rest, and Zakai last', () => {
  const teachers = [
    'Zakai',
    'Captain Yahn',
    'Officer Abraham',
    'Deacon Eythan',
    'Bishop Kani',
    'Bishop Yawasap',
    'Bishop Nathanyel',
  ]
  expect([...teachers].sort((a, b) => classTeacherRank(a) - classTeacherRank(b))).toEqual([
    'Bishop Nathanyel',
    'Bishop Yawasap',
    'Bishop Kani',
    'Deacon Eythan',
    'Captain Yahn',
    'Officer Abraham',
    'Zakai',
  ])
  expect(classTeacherRank('Elder Nathanyel')).toBe(classTeacherRank('Bishop Nathanyel'))
  expect(classTeacherRank('Bishop Kana')).toBe(classTeacherRank('Bishop Kani'))
})
