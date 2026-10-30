// The pieces of the on-device class search that need no database: what a typed search asks the
// library's full-text index, and the moment in a class where the words were said.

const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu

/** The words of a search, as the full-text index matches them. */
export const searchWords = (query: string) =>
  [...query.toLowerCase().matchAll(WORD)]
    .map(match => match[0].replace(/['’-]+$/, ''))
    .filter(Boolean)

/**
 * A full-text query for the words: a phrase in quotes is matched as a phrase, every other word
 * must be there, and the last word may be the start of a longer one while it is still being typed.
 */
export const ftsQuery = (query: string): string => {
  const phrases = [...query.matchAll(/"([^"]+)"/g)].map(match => searchWords(match[1]))
  const rest = searchWords(query.replace(/"[^"]*"/g, ' '))
  const parts = [
    ...phrases.filter(words => words.length).map(words => `"${words.join(' ')}"`),
    ...rest.map((word, index) =>
      index === rest.length - 1 && word.length >= 3 && !/"\s*$/.test(query)
        ? `"${word}"*`
        : `"${word}"`
    ),
  ]
  return parts.join(' ')
}

/**
 * Where in a class the words were said: the last timestamp the notes give before the first place
 * they appear, so the class can be played from there.
 */
export const momentOf = (body: string, query: string): number | undefined => {
  const lower = body.toLowerCase()
  const words = searchWords(query.replace(/"/g, ' '))
  const phrase = words.join(' ')
  let at = phrase ? lower.indexOf(phrase) : -1
  if (at < 0) {
    const found = words.map(word => lower.indexOf(word)).filter(index => index >= 0)
    at = found.length ? Math.min(...found) : -1
  }
  if (at < 0) return undefined
  let seconds: number | undefined
  for (const match of body.slice(0, at).matchAll(/[?&]t=(\d+)s/g)) seconds = Number(match[1])
  return seconds
}
