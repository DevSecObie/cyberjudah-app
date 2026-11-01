jest.mock('~i18n', () => ({
  __esModule: true,
  default: { t: (key: string) => ({ Genèse: 'Genesis', Exode: 'Exodus' })[key] ?? key },
}))

import { askReading } from '../askReading'

describe('Ask from the Bible reader', () => {
  it('names the open verse in English', () => {
    expect(askReading(['1-1-3'])).toBe('Genesis 1:3')
  })
  it('keeps a run of verses as a range, in order', () => {
    expect(askReading(['2-12-3', '2-12-1', '2-12-2'])).toBe('Exodus 12:1-3')
  })
  it('takes the first verse when the selection skips', () => {
    expect(askReading(['2-12-1', '2-12-5'])).toBe('Exodus 12:1')
  })
  it('gives none across chapters or for bad ids', () => {
    expect(askReading(['1-1-1', '1-2-1'])).toBeUndefined()
    expect(askReading(['x'])).toBeUndefined()
    expect(askReading([])).toBeUndefined()
  })
})
