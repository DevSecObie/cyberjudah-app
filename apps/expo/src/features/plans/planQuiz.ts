/**
 * Ten questions on a day's chapters. Where the day has notes, most come from the breakdowns in
 * them: which scripture a point was taught on, which precept was read with a scripture, and a
 * point with a word left out. The rest, and every question on a day without notes, come from
 * the chapters' own words: a verse with one word left out, or a verse whose chapter is to be
 * named. Nothing is written for the quiz; every question and every choice is the notes or the
 * text itself. The same day always gives the same questions.
 */

export type QuizVerse = {
  /** "Genesis 1" */
  chapterName: string
  /** "Genesis 1:3" */
  reference: string
  text: string
}

export type QuizQuestion = {
  kind: 'word' | 'chapter' | 'taught' | 'precept' | 'point'
  /** The verse or breakdown as asked: with "_____" in place of the missing word, or whole. */
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

/** One scripture of a note: the points taught on it and the precepts read with it. */
export type NoteUnit = {
  /** "Romans 6:1-2" */
  reference: string
  points: string[]
  precepts: string[]
}

/** A breakdown as read: links, bold and quote marks of markdown taken out. */
const plainPoint = (text: string) =>
  text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*?|__|`/g, '')
    .replace(/\*\[[^\]]*\]\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/** The scriptures of a note in the study-note shape (docs/study), with their points and precepts. */
export const noteUnits = (body: string): NoteUnit[] => {
  const units: NoteUnit[] = []
  let inPrecepts = false
  for (const line of body.split('\n')) {
    const heading = /^\*\*\[([^\]]+)\]\(\/bible\/[^)]*\)\*\*/.exec(line)
    if (heading) {
      units.push({ reference: heading[1], points: [], precepts: [] })
      inPrecepts = false
      continue
    }
    const unit = units[units.length - 1]
    if (!unit) continue
    if (/^#{1,6} /.test(line)) {
      units.pop()
      continue
    }
    if (/^\s+Precepts:/.test(line)) {
      inPrecepts = true
      continue
    }
    const precept = /^\s+- \*\*\[([^\]]+)\]\(\/bible\//.exec(line)
    if (precept && inPrecepts) {
      unit.precepts.push(precept[1])
      continue
    }
    const point = /^- (.+)$/.exec(line)
    if (point) {
      inPrecepts = false
      const text = plainPoint(point[1])
      if (text.length >= 50 && text.length <= 320) unit.points.push(text)
    }
  }
  return units.filter(unit => unit.points.length || unit.precepts.length)
}

const differentFrom = (reference: string) => {
  // "Romans 6:1-2" and "Romans 6:1" read as the same place; choices must not.
  const start = reference.replace(/-\d+$/, '')
  return (other: string) => other.replace(/-\d+$/, '') !== start
}

/** "Which scripture was this taught on?" The point, with the scripture's own words hidden. */
const taughtQuestion = (
  unit: NoteUnit,
  point: string,
  references: string[],
  random: () => number
): QuizQuestion | undefined => {
  const others = shuffle(references.filter(differentFrom(unit.reference)), random).slice(0, 3)
  if (others.length < 3) return undefined
  return {
    kind: 'taught',
    // A point that names its own scripture would give the answer.
    prompt: point.split(unit.reference).join('this scripture'),
    choices: shuffle([unit.reference, ...others], random),
    answer: unit.reference,
    reference: unit.reference,
  }
}

/** "Which precept was read with this scripture?" */
const preceptQuestion = (
  unit: NoteUnit,
  all: NoteUnit[],
  textOf: (reference: string) => string | undefined,
  random: () => number
): QuizQuestion | undefined => {
  const answer = unit.precepts[Math.floor(random() * unit.precepts.length)]
  const own = new Set(unit.precepts)
  const pool = [...new Set(all.flatMap(other => other.precepts))].filter(
    reference => !own.has(reference)
  )
  const others = shuffle(pool, random).slice(0, 3)
  if (others.length < 3) return undefined
  return {
    kind: 'precept',
    // The scripture's words, with its place shown under them.
    prompt: textOf(unit.reference) ?? unit.reference,
    choices: shuffle([answer, ...others], random),
    answer,
    reference: unit.reference,
  }
}

/** A point of the breakdown with one of its words left out. */
const pointQuestion = (
  unit: NoteUnit,
  point: string,
  pool: { names: string[]; words: string[] },
  random: () => number
): QuizQuestion | undefined => {
  const question = wordQuestion(
    { chapterName: '', reference: unit.reference, text: point },
    pool,
    random
  )
  return question && { ...question, kind: 'point' }
}

/**
 * The day's ten questions from its notes and chapters: most on the breakdowns, a few on the
 * chapters' words. A day whose notes give too little falls back on the chapters alone.
 */
export const buildDayQuiz = (
  notes: string[],
  verses: QuizVerse[],
  seed: string
): QuizQuestion[] => {
  const units = notes.flatMap(noteUnits)
  const random = sequence(`${seed}/notes`)
  const references = [...new Set(units.map(unit => unit.reference))]
  const allPoints = units.flatMap(unit => unit.points)
  const all = allPoints.flatMap(point => wordsOf(point).slice(1).filter(isWord))
  const unique = (list: string[]) => [...new Set(list)]
  const pool = {
    names: unique(all.filter(isName)),
    words: unique(all.filter(word => !isName(word))),
  }

  // In turn, from scriptures spread over the day: which scripture, which precept, a missing word.
  const order = shuffle(units, random)
  // The first verse of a scripture, from the day's chapters ("Genesis 3:7-8" -> verse 7).
  const verseText = new Map(verses.map(verse => [verse.reference, plainVerse(verse.text)]))
  const textOf = (reference: string) => {
    const first = /^(.+?:\d+)/.exec(reference)?.[1]
    return first ? verseText.get(first) : undefined
  }
  const makers: ((unit: NoteUnit) => QuizQuestion | undefined)[] = [
    unit =>
      unit.points.length
        ? taughtQuestion(
            unit,
            unit.points[Math.floor(random() * unit.points.length)],
            references,
            random
          )
        : undefined,
    unit => (unit.precepts.length ? preceptQuestion(unit, units, textOf, random) : undefined),
    unit =>
      unit.points.length
        ? pointQuestion(unit, unit.points[Math.floor(random() * unit.points.length)], pool, random)
        : undefined,
  ]
  const fromNotes: QuizQuestion[] = []
  const asked = new Set<string>()
  const wanted = QUIZ_LENGTH - 3
  for (let round = 0; round < 3 && fromNotes.length < wanted; round++)
    for (const unit of order) {
      if (fromNotes.length >= wanted) break
      const maker = makers[(fromNotes.length + round) % makers.length]
      const question = maker(unit)
      const key = `${question?.kind} ${question?.prompt}`
      if (!question || asked.has(key)) continue
      asked.add(key)
      fromNotes.push(question)
    }
  // The rest from the chapters' own words: a few verses with a word left out.
  const fromText = buildPlanQuiz(verses, seed).filter(
    question => fromNotes.length < 4 || question.kind === 'word'
  )
  const questions = [...fromNotes, ...fromText].slice(0, QUIZ_LENGTH)
  // Mixed, so the kinds do not come in a block.
  return shuffle(questions, sequence(`${seed}/order`))
}
