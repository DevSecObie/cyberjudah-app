import { ftsQuery, momentOf, searchWords } from '../classIndexQuery'

describe('ftsQuery', () => {
  it('needs every word, and lets the last one still be typed', () => {
    expect(ftsQuery('slave ships')).toBe('"slave" "ships"*')
  })

  it('keeps a quoted phrase together, and drops what the index cannot match', () => {
    expect(ftsQuery('"house of bondage" Egypt!')).toBe('"house of bondage" "egypt"*')
    expect(searchWords('Gad’s * OR "x')).toEqual(['gad’s', 'or', 'x'])
  })

  it('treats a short last word as whole', () => {
    expect(ftsQuery('the ox')).toBe('"the" "ox"')
  })
})

describe('momentOf', () => {
  const V = 'https://www.youtube.com/watch?v=AAAAAAAAAAA&t='
  const body = [
    `*[[1:00](${V}60s)]* Introduction.`,
    `*[[5:00](${V}300s)]* The slave ships came to the West Indies.`,
    `*[[9:00](${V}540s)]* Later, ships again.`,
  ].join('\n\n')

  it('finds the timestamp before the words', () => {
    expect(momentOf(body, 'slave ships')).toBe(300)
  })

  it('prefers the phrase, else the first word it finds', () => {
    expect(momentOf(body, 'ships again')).toBe(540)
    expect(momentOf(body, 'again slave')).toBe(300)
    expect(momentOf(body, 'nothing here')).toBeUndefined()
  })
})
