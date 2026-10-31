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
  '2edsras': '2esdras',
  wisdom: 'wisdomofsolomon',
  restofest: 'restofesther',
  haggi: 'haggai',
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
      .replace(/\bW\.O\.S\b/g, 'Wisdom of Solomon')
      .replace(/\([^)]*\)|\[[^\]]*\]|"[^"]*"/g, ' ')
      .replace(/\b4\s*chapters?(\s*a)?(\s*day)?/gi, ' ')
      .match(/[1-3](?:st|nd|rd)?\s?[A-Za-z]+(?:\s+of\s+[A-Za-z]+)?|[A-Za-z]+(?:\s+of\s+[A-Za-z]+)?|\d+|[-&;,]/gi) ?? []
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

// Days the playlist has no video for take the class's other uploads (data/four-chapters-a-day-
// videos-extra.tsv), then the IUIC 4 Chapters a Day channel (…-channel.tsv). Their titles vary
// ("JEREMIAH 49-52", "Amos 7-Obadiah"), so these entries are named from their chapters.
const position = new Map(chapters.map(({ book, chapter }, index) => [`${book.id}:${chapter}`, index]))
const nameOf = covered => {
  const runs = []
  for (const key of [...covered].filter(key => position.has(key)).sort((a, b) => position.get(a) - position.get(b))) {
    const { book, chapter } = chapters[position.get(key)]
    const run = runs[runs.length - 1]
    if (run && run.book.id === book.id) run.to = chapter
    else runs.push({ book, from: chapter, to: chapter })
  }
  const chaptersOf = run => (run.from === run.to ? `${run.from}` : `${run.from}–${run.to}`)
  if (runs.length === 1) return `${runs[0].book.name} ${chaptersOf(runs[0])}`
  return runs.map(run => `${run.book.name} ${chaptersOf(run)}`).join(', ')
}
const fillVideos = file => {
  const list = []
  const seen = new Set()
  for (const line of readFileSync(resolve(import.meta.dirname, 'data', file), 'utf8').split('\n')) {
    const [video, title, chaptersText] = line.split('\t')
    if (!title || line.startsWith('#') || video === 'video') continue
    const { covered } = videoChapters(chaptersText || title)
    if (!covered.length) throw new Error(`Cannot read the chapters of "${title}"`)
    const name = nameOf(covered)
    // The channel uploaded a few sessions twice.
    if (seen.has(name)) continue
    seen.add(name)
    list.push({ video, name, covered: new Set(covered) })
  }
  return list
}
const fillSources = [
  fillVideos('four-chapters-a-day-videos-extra.tsv'),
  fillVideos('four-chapters-a-day-videos-channel.tsv'),
]

// Where each class's reading begins, past the prayer and opening: "video<TAB>seconds", found from
// the class's own transcript (data/four-chapters-a-day-starts.tsv). A class not listed starts at 0.
const startsFile = resolve(import.meta.dirname, 'data/four-chapters-a-day-starts.tsv')
const readingStarts = new Map(
  existsSync(startsFile)
    ? readFileSync(startsFile, 'utf8')
        .split('\n')
        .filter(line => line && !line.startsWith('#') && !line.startsWith('video\t'))
        .map(line => line.split('\t'))
        .filter(([, seconds]) => Number(seconds) > 0)
        .map(([video, seconds]) => [video, Number(seconds)])
    : []
)

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
  const covers = ({ covered }) => day.some(({ book, chapter }) => covered.has(`${book.id}:${chapter}`))
  let sessions = videos.filter(covers)
  for (const source of fillSources) if (!sessions.length) sessions = source.filter(covers)
  // In reading order: the session that starts earliest first.
  const first = ({ covered }) =>
    Math.min(...day.map(({ book, chapter }, index) => (covered.has(`${book.id}:${chapter}`) ? index : Infinity)))
  sessions = [...sessions].sort((a, b) => first(a) - first(b))
  for (const { video, name } of sessions)
    slices.push({
      id: String(slices.length),
      type: 'Video',
      title: `The class: ${name}`,
      url: `https://www.youtube.com/watch?v=${video}`,
      ...(readingStarts.has(video) ? { start: readingStarts.get(video) } : {}),
    })
  for (const { book, chapter } of day) {
    // The notes keep the Greek additions with Esther (docs/study/esther/11-16).
    const note = noteFor(book.slug === 'esther-greek' ? 'esther' : book.slug, chapter)
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
  // The notes carry the chapters' verses, so a day with notes has no separate chapters row; a
  // day without them keeps one, or it would have nothing to read.
  if (!slices.some(slice => slice.type === 'Text'))
    for (const run of runs)
      slices.push({
        id: String(slices.length),
        type: 'Chapter',
        chapters: `${run.book.id}|${run.from === run.to ? run.from : `${run.from}-${run.to}`}`,
      })
  // Last, ten questions on the day's chapters, drawn from their own text in the app.
  slices.push({
    id: String(slices.length),
    type: 'Quiz',
    title: `Quiz: ${label(day)}`,
    chapters: runs.map(
      run => `${run.book.id}|${run.from === run.to ? run.from : `${run.from}-${run.to}`}`
    ),
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
if (process.env.DUMP_SESSIONS) {
  const noteSlug = book => (book.slug === 'esther-greek' ? 'esther' : book.slug)
  const sessions = [...videos, ...fillSources.flat()].map(({ video, name, covered }) => ({
    video,
    name,
    missing: [...covered]
      .filter(key => position.has(key))
      .map(key => chapters[position.get(key)])
      .filter(({ book, chapter }) => !existsSync(resolve(studyDir, noteSlug(book), `${chapter}.md`)))
      .map(({ book, chapter }) => `${book.slug} ${chapter}`),
  }))
  writeFileSync(process.env.DUMP_SESSIONS, JSON.stringify(sessions.filter(s => s.missing.length), null, 1))
}
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
