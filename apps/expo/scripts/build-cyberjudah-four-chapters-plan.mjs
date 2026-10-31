// Build the 4 Chapters a Day journey (src/assets/plans/cyberjudah-four-chapters-a-day.txt) from
// the 4 Chapters a Day notes in the cyberjudah content repo (docs/study/<book>/<chapter>.md).
// The whole KJV with Apocrypha is read four chapters a day: the Old Testament, the Apocrypha
// between the testaments, then the New Testament. A day carries the opening of our note for each
// of its chapters that has one.
// Usage: node scripts/build-cyberjudah-four-chapters-plan.mjs [path to the cyberjudah repo]
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const contentRepo = resolve(process.argv[2] ?? resolve(import.meta.dirname, '../../../../cyberjudah'))
const studyDir = resolve(contentRepo, 'docs/study')
const books = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../src/assets/cyberjudah/books.json'), 'utf8')
)
const output = resolve(import.meta.dirname, '../src/assets/plans/cyberjudah-four-chapters-a-day.txt')
const PER_DAY = 4

if (!existsSync(studyDir)) throw new Error(`No 4 Chapters a Day notes at ${studyDir}`)

const testament = book => (book.id <= 39 ? 'old' : book.id <= 66 ? 'new' : 'apocrypha')
const order = ['old', 'apocrypha', 'new']
const readingOrder = order.flatMap(part => books.filter(book => testament(book) === part))
const sectionTitles = {
  old: 'The Old Testament',
  apocrypha: 'The Apocrypha',
  new: 'The New Testament',
}

// "[Psalm 3](/bible/psalms/3)" → "Psalm 3"; bold and italics marks are dropped.
const plain = text =>
  text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*|__/g, '')
    .replace(/(^|\s)[*_]([^*_]+)[*_]/g, '$1$2')
    .trim()

// The note's title, its opening paragraph (the summary of the session) and its page: the entry
// opens the whole note.
const noteFor = (slug, chapter) => {
  const file = resolve(studyDir, slug, `${chapter}.md`)
  if (!existsSync(file)) return undefined
  const source = readFileSync(file, 'utf8')
  const title = /^title:\s*"?(.*?)"?\s*$/m.exec(source)?.[1]
  const body = source.replace(/^---[\s\S]*?\n---\n/, '')
  // The opening comes before the first verse heading, list or quote; a note that starts with a
  // verse has no opening of its own.
  let opening
  for (const paragraph of body.split(/\n\s*\n/).map(part => part.trim())) {
    if (!paragraph || paragraph.startsWith('Read the chapter') || paragraph === '## Introduction')
      continue
    if (!/^[#>*<-]|^Topics:/.test(paragraph)) opening = paragraph
    break
  }
  // Chapters without a class session only carry the King James text, which the reader already shows.
  if (!title || (opening && /no recorded class session/i.test(opening))) return undefined
  const notePath = /^slug:\s*"?(\/study\/[^"\s]+)"?\s*$/m.exec(source)?.[1] ?? `/study/${slug}/${chapter}`
  return { title: plain(title), description: opening ? plain(opening) : '', notePath }
}

const chapters = readingOrder.flatMap(book =>
  book.chapters.map(chapter => ({ book, chapter, part: testament(book) }))
)

// The class's session videos (scripts/data/four-chapters-a-day-videos.tsv), read from titles such
// as "Iuic: 4 Chapters A Day: Ruth 4 & 1st Samuel 1-3": each video covers a set of chapters.
const bookByName = new Map(
  books.map(book => [book.name.toLowerCase().replace(/\s+/g, ''), book])
)
const aliases = {
  psalm: 'psalms',
  hoea: 'hosea',
  lamentation: 'lamentations',
  songsofsolomon: 'songofsolomon',
  '1chroicles': '1chronicles',
}
const bookFor = word => {
  const key = word.toLowerCase().replace(/(\d)(st|nd|rd)/, '$1').replace(/\s+/g, '')
  return bookByName.get(aliases[key] ?? key)
}
const lastChapter = book => book.chapters[book.chapters.length - 1]
const estherGreek = books.find(book => book.slug === 'esther-greek')

const videoChapters = (title, fallbackBook) => {
  const covered = []
  const add = (book, from, to) => {
    for (let chapter = from; chapter <= to; chapter++)
      // The class read the Greek additions as Esther 11-16.
      covered.push(book.slug === 'esther' && chapter > 10 ? `${estherGreek.id}:${chapter}` : `${book.id}:${chapter}`)
  }
  const tokens =
    title
      .replace(/\([^)]*\)|\[[^\]]*\]|"[^"]*"/g, ' ')
      .replace(/\b4\s*chapters?(\s*a)?(\s*day)?/gi, ' ')
      .match(/[1-3](?:st|nd|rd)?\s?[A-Za-z]+(?:\s+of\s+[A-Za-z]+)?|[A-Za-z]+(?:\s+of\s+[A-Za-z]+)?|\d+|[-&;,]/g) ?? []
  let book = fallbackBook
  let start
  let crossFrom
  let dash = false
  for (const token of tokens) {
    if (/^\d+$/.test(token)) {
      const n = Number(token)
      if (dash && start !== undefined && book) {
        if (crossFrom) {
          add(crossFrom, start, lastChapter(crossFrom))
          add(book, 1, n)
        } else add(book, start, n)
        start = undefined
        crossFrom = undefined
      } else {
        if (start !== undefined && book) add(book, start, start)
        start = n
      }
      dash = false
    } else if (token === '-') dash = true
    else if (/^[&;,]$/.test(token)) {
      if (start !== undefined && book) add(book, start, start)
      start = undefined
      dash = false
    } else {
      const named = bookFor(token)
      if (!named) continue
      if (dash && start !== undefined) crossFrom = book
      book = named
    }
  }
  if (start !== undefined && book) add(book, start, start)
  return { covered, book }
}

const videos = []
{
  let previousBook
  for (const line of readFileSync(resolve(import.meta.dirname, 'data/four-chapters-a-day-videos.tsv'), 'utf8').split('\n')) {
    const [video, title] = line.split('\t')
    if (!title || line.startsWith('#') || video === 'video') continue
    const { covered, book } = videoChapters(title, previousBook)
    if (!covered.length) throw new Error(`Cannot read the chapters of "${title}"`)
    // "Iuic: 4 Chapters A Day: 2 Samuel 9-12 (READ)" → "2 Samuel 9-12"
    let name = title
      .replace(/\([^)]*\)|\[[^\]]*\]|"[^"]*"|#\S+|[^\x20-\x7E]/g, ' ')
      .replace(/^\s*iuic:?/i, '')
      .replace(/\b4\s*chapters?(\s*a)?(\s*day)?\s*[:/]?/i, '')
      .replace(/\bchapters\b/i, '')
      .replace(/\s+/g, ' ')
      .replace(/^[\s:/]+|[\s:]+$/g, '')
    if (/^\d+\s*-/.test(name) && previousBook) name = `${previousBook.name} ${name}`
    previousBook = book
    videos.push({ video, name, covered: new Set(covered) })
  }
}

const days = []
for (let i = 0; i < chapters.length; i += PER_DAY) days.push(chapters.slice(i, i + PER_DAY))

const label = day => {
  const first = day[0]
  const last = day[day.length - 1]
  if (first.book.id !== last.book.id)
    return `${first.book.name} ${first.chapter} – ${last.book.name} ${last.chapter}`
  return first.chapter === last.chapter
    ? `${first.book.name} ${first.chapter}`
    : `${first.book.name} ${first.chapter}–${last.chapter}`
}

const sliceFor = (day, dayNumber) => {
  const slices = []
  const sessions = videos.filter(({ covered }) =>
    day.some(({ book, chapter }) => covered.has(`${book.id}:${chapter}`))
  )
  for (const { video, name } of sessions)
    slices.push({
      id: String(slices.length),
      type: 'Video',
      title: `The class: ${name}`,
      url: `https://www.youtube.com/watch?v=${video}`,
    })
  for (const { book, chapter } of day) {
    const note = noteFor(book.slug, chapter)
    if (note && !slices.some(slice => slice.notePath === note.notePath))
      slices.push({ id: String(slices.length), type: 'Text', ...note })
  }
  // One passage per book: "1|1-4", or two when the day crosses into the next book.
  const runs = []
  for (const { book, chapter } of day) {
    const run = runs[runs.length - 1]
    if (run && run.book.id === book.id) run.to = chapter
    else runs.push({ book, from: chapter, to: chapter })
  }
  for (const run of runs)
    slices.push({
      id: String(slices.length),
      type: 'Chapter',
      chapters: `${run.book.id}|${run.from === run.to ? run.from : `${run.from}-${run.to}`}`,
    })
  return { id: String(dayNumber), title: label(day), slices }
}

const sections = order.map(part => ({
  id: part,
  title: sectionTitles[part],
  subTitle: '',
  readingSlices: [],
}))
days.forEach((day, index) => {
  const section = sections.find(item => item.id === day[0].part)
  section.readingSlices.push(sliceFor(day, index + 1))
})

const plan = {
  id: 'cyberjudah-four-chapters-a-day',
  kind: 'reading-plan',
  type: 'reading-plan',
  lang: 'en',
  title: '4 Chapters a Day',
  image: 'cyberjudah-lion-reading',
  description:
    'The daily reading, four chapters a day, as the class reads it: the whole King James Bible with the Apocrypha, from Genesis to Revelation. Each day has the class video where the session was recorded, and our notes from the session that taught those chapters.',
  duration: days.length,
  author: { id: 'cyberjudah', displayName: 'CyberJudah', photoUrl: '' },
  sections: sections.filter(section => section.readingSlices.length),
}

writeFileSync(output, JSON.stringify(plan, null, 2) + '\n')
const withVideos = plan.sections
  .flatMap(section => section.readingSlices)
  .filter(reading => reading.slices.some(slice => slice.type === 'Video')).length
console.log(`${withVideos} days with the class video`)
const withNotes = days.filter((_, index) =>
  plan.sections
    .flatMap(section => section.readingSlices)
    [index].slices.some(slice => slice.type === 'Text')
).length
console.log(`${days.length} days, ${withNotes} with notes → ${output}`)
