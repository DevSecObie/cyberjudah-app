/**
 * Ten questions on a day's chapters, made only from the words of those chapters: a verse with one
 * word left out, or a verse whose chapter is to be named. Nothing is written for the quiz; every
 * question and every choice is the text itself. The same day always gives the same questions.
 */

export type QuizVerse = {
  /** "Genesis 1" */
  chapterName: string
  /** "Genesis 1:3" */
  reference: string
  text: string
}

export type QuizQuestion = {
  kind: 'word' | 'chapter'
  /** The verse as asked: with "_____" in place of the missing word, or whole. */
  prompt: string
  choices: string[]
  answer: string
  reference: string
}

export const QUIZ_LENGTH = 10

// Little words that make poor questions.
const SKIP = new Set(
  (
    'about above after again against all also among and any are because been before being ' +
    'between both but came come could did does doing down during each even every from had has ' +
    'have having her here hers herself him himself his how into its itself let more most not ' +
    'now off once only other our ours out over own same said say shall she should some such ' +
    'than that the their theirs them themselves then there these they thee thine this those ' +
    'thou through thus thy till too under until upon very was were what when where which ' +
    'while who whom whose why will with would yea yet you your yours unto also hath doth ' +
    'saith shalt wilt didst hast art'
  ).split(' ')
)

/** The verse as read: no Strong's numbers, notes or markup that some texts carry. */
export const plainVerse = (text: string) =>
  text
    .replace(/<[^>]*>/g, '')
    .replace(/\{[^}]*\}|\[[^\]]*\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/** A small fixed sequence of numbers from a seed, so a day's quiz never changes. */
const sequence = (seed: string) => {
  let state = 2166136261
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0
  return () => {
    state = (Math.imul(state ^ (state >>> 15), 2246822507) + 0x6d2b79f5) >>> 0
    return state / 4294967296
  }
}

const shuffle = <T>(items: T[], random: () => number) => {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1))
    ;[copy[index], copy[other]] = [copy[other], copy[index]]
  }
  return copy
}

const isName = (word: string) => /^[A-Z][a-z]+$/.test(word)
const isWord = (word: string) => /^[A-Za-z]{5,}$/.test(word) && !SKIP.has(word.toLowerCase())

const wordsOf = (text: string) => text.match(/[A-Za-z]+/g) ?? []

const wordQuestion = (
  verse: QuizVerse,
  pool: { names: string[]; words: string[] },
  random: () => number
): QuizQuestion | undefined => {
  const words = wordsOf(verse.text)
  // Not the verse's first word, which is capitalised whatever it is, and not a word the verse
  // repeats, which would give the answer away.
  const count = (word: string) => words.filter(item => item === word).length
  const candidates = words.slice(1).filter(word => isWord(word) && count(word) === 1)
  if (!candidates.length) return undefined
  const names = candidates.filter(isName)
  const answer = (names.length ? names : candidates)[
    Math.floor(random() * (names.length || candidates.length))
  ]
  const sameKind = isName(answer) ? pool.names : pool.words
  const inVerse = new Set(words.map(word => word.toLowerCase()))
  // Choices that look alike (same ending, as "sanctified", "blessed") so the form gives
  // nothing away; others only when there are too few.
  const pool2 = shuffle(
    sameKind.filter(word => !inVerse.has(word.toLowerCase())),
    random
  )
  const ending = answer.slice(-2).toLowerCase()
  const alike = pool2.filter(word => word.slice(-2).toLowerCase() === ending)
  const others = [...alike, ...pool2.filter(word => !alike.includes(word))].slice(0, 3)
  if (others.length < 3) return undefined
  const at = new RegExp(`\\b${answer}\\b`)
  return {
    kind: 'word',
    prompt: verse.text.replace(at, '_____'),
    choices: shuffle([answer, ...others], random),
    answer,
    reference: verse.reference,
  }
}

const chapterQuestion = (
  verse: QuizVerse,
  chapterNames: string[],
  random: () => number
): QuizQuestion => {
  const others = shuffle(
    chapterNames.filter(name => name !== verse.chapterName),
    random
  ).slice(0, 3)
  return {
    kind: 'chapter',
    prompt: verse.text,
    choices: shuffle([verse.chapterName, ...others], random),
    answer: verse.chapterName,
    reference: verse.reference,
  }
}

/** The day's ten questions; fewer only if the chapters are too short to give ten. */
export const buildPlanQuiz = (verses: QuizVerse[], seed: string): QuizQuestion[] => {
  const random = sequence(seed)
  const cleaned = verses
    .map(verse => ({ ...verse, text: plainVerse(verse.text) }))
    .filter(verse => verse.text.length >= 40 && verse.text.length <= 260)
  if (!cleaned.length) return []
  const all = cleaned.flatMap(verse => wordsOf(verse.text).slice(1).filter(isWord))
  const unique = (list: string[]) => [...new Set(list)]
  const pool = {
    names: unique(all.filter(isName)),
    words: unique(all.filter(word => !isName(word))),
  }
  const chapterNames = unique(cleaned.map(verse => verse.chapterName))

  // Verses spread across the day's chapters, taken in turn.
  const byChapter = chapterNames.map(name =>
    shuffle(
      cleaned.filter(verse => verse.chapterName === name),
      random
    )
  )
  const picked: QuizVerse[] = []
  for (let round = 0; picked.length < cleaned.length; round++) {
    const before = picked.length
    for (const list of byChapter) if (list[round]) picked.push(list[round])
    if (picked.length === before) break
  }

  const questions: QuizQuestion[] = []
  const used = new Set<string>()
  for (const verse of picked) {
    if (questions.length >= QUIZ_LENGTH) break
    if (used.has(verse.reference)) continue
    // Every third question names the chapter, when the day has more than one.
    const askChapter = chapterNames.length > 1 && questions.length % 3 === 2
    const question = askChapter
      ? chapterQuestion(verse, chapterNames, random)
      : wordQuestion(verse, pool, random)
    if (!question) continue
    used.add(verse.reference)
    questions.push(question)
  }
  return questions
}
