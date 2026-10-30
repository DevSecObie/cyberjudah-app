import { SPINNER, spinnerLine, toneOf } from '../cyberJudahSpinner'
it('preserves Telegram’s original question-specific progress wording', () => {
  expect(toneOf('What does the law say about usury?')).toBe('law')
  expect(toneOf('What did I ask earlier?')).toBe('memory')
  expect(SPINNER.scripture).toContain('Rightly dividing the word of truth')
  expect(SPINNER.law).toContain('Reading in the book of the law distinctly')
  const question = 'What does the law say about usury?'
  expect(SPINNER.law).toContain(spinnerLine(question, 0))
  expect(spinnerLine(question, 0)).not.toBe(spinnerLine(question, 1))
  expect(spinnerLine(question, SPINNER.law.length)).toBe(spinnerLine(question, 0))
})
