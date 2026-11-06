import fs from 'node:fs'
import path from 'node:path'
import type { ComputedPlan } from '~common/types'
import { getFourChaptersBooks } from '../fourChaptersBooks'
const source = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '../../../assets/plans/cyberjudah-four-chapters-a-day.txt'),
    'utf8'
  )
)
const sections = source.sections.map((section: { title: string; readingSlices: unknown[] }) => ({
  title: section.title,
  data: section.readingSlices,
})) as ComputedPlan['sections']
test('all daily readings remain reachable, grouped by testament, without modifying the series', () => {
  const before = JSON.stringify(sections)
  const groups = getFourChaptersBooks(sections)
  const days = new Set(
    groups.flatMap(section =>
      section.books.flatMap(book => book.readings.map(reading => reading.day))
    )
  )
  expect([...days].sort((a, b) => a - b)).toEqual(
    Array.from({ length: source.duration }, (_, i) => i + 1)
  )
  expect(groups.map(group => group.title)).toEqual([
    'The Old Testament',
    'The Apocrypha',
    'The New Testament',
  ])
  expect(JSON.stringify(sections)).toBe(before)
})
test('a day crossing a book boundary appears in both books under its original day number', () => {
  const books = getFourChaptersBooks(sections).flatMap(section => section.books)
  const genesis = books.find(book => book.title === 'Genesis')!
  const exodus = books.find(book => book.title === 'Exodus')!
  expect(genesis.readings.at(-1)?.day).toBe(exodus.readings[0].day)
  expect(genesis.readings[0]).toEqual({ day: 1, title: 'Genesis 1–4' })
})
test('numbered book names stay intact and each book lists each day only once, in order', () => {
  const books = getFourChaptersBooks(sections).flatMap(section => section.books)
  expect(books).toHaveLength(81)
  expect(new Set(books.map(book => book.title)).size).toBe(81)
  expect(
    books.find(book => book.title === 'Judith')!.readings.some(reading => reading.day === 243)
  ).toBe(true)
  expect(
    books.find(book => book.title === '2 John')!.readings.some(reading => reading.day === 335)
  ).toBe(true)
  expect(books.find(book => book.title === 'Rest of Esther')!.readings).toHaveLength(2)
  expect(books.some(book => book.title === '1 Samuel')).toBe(true)
  expect(books.some(book => book.title === '2 Samuel')).toBe(true)
  for (const book of books) {
    const days = book.readings.map(reading => reading.day)
    expect(days).toEqual([...new Set(days)].sort((a, b) => a - b))
  }
})
