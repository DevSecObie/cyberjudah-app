import { readFileSync } from 'fs'
import { join } from 'path'
import { buildDayQuiz, noteUnits, QUIZ_LENGTH } from '../planQuiz'

const note = readFileSync(join(__dirname, 'fixtures/romans-6.md'), 'utf8')

describe('noteUnits', () => {
  it('reads each scripture of a study note with its points and precepts', () => {
    const units = noteUnits(note)
    expect(units.length).toBeGreaterThan(3)
    expect(units[0].reference).toMatch(/^Romans 6:\d/)
    expect(units.some(unit => unit.precepts.length)).toBe(true)
    expect(units.flatMap(unit => unit.points).every(point => !point.includes('](/'))).toBe(true)
  })
})

describe('buildDayQuiz', () => {
  const questions = buildDayQuiz([note], [], 'plan/day-1')

  it('asks mostly on the breakdowns', () => {
    expect(questions.length).toBeGreaterThanOrEqual(6)
    expect(questions.length).toBeLessThanOrEqual(QUIZ_LENGTH)
    const kinds = new Set(questions.map(question => question.kind))
    expect(kinds.has('taught')).toBe(true)
    expect(kinds.has('precept')).toBe(true)
  })

  it('gives four different choices with the answer among them', () => {
    for (const question of questions) {
      expect(new Set(question.choices).size).toBe(4)
      expect(question.choices).toContain(question.answer)
    }
  })

  it('never names the answer in a which-scripture question', () => {
    for (const question of questions.filter(item => item.kind === 'taught'))
      expect(question.prompt).not.toContain(question.answer)
  })

  it('is the same for the same day', () => {
    expect(buildDayQuiz([note], [], 'plan/day-1')).toEqual(questions)
  })
})
