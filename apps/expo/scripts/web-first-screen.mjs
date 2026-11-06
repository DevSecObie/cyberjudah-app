// Runs after `expo export --platform web`: inlines web-first-screen.js into dist/index.html with
// what it needs to draw the opening chapter before the app has loaded (the chapter API's address,
// the English book names the app shows, and the reading face's file).
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const dist = join(root, 'dist')
const api = process.env.EXPO_PUBLIC_RESOURCE_API_URL
if (!api) {
  // Builds without the CyberJudah resource API (CI checks, Bible Strong's own setup) keep the
  // lion: the inline script is left out and index.html is unchanged.
  console.log('First screen: EXPO_PUBLIC_RESOURCE_API_URL is not set, keeping the launch screen')
  process.exit(0)
}

// The app names a book by translating its upstream French name (books-desc.ts) into English.
const booksSource = await readFile(join(root, 'src/assets/bible_versions/books-desc.ts'), 'utf8')
const upstream = booksSource.slice(booksSource.indexOf('const upstreamBooks'))
// Same merge as i18n/index.tsx.
const english = {}
for (const file of ['translation.json', 'translation_book.json']) {
  Object.assign(english, JSON.parse(await readFile(join(root, 'i18n/locales/en', file), 'utf8')))
}
const books = {}
for (const [, number, name] of upstream.matchAll(
  /Numero:\s*(\d+),\s*Nom:\s*'((?:[^'\\]|\\.)*)'/g
)) {
  const french = name.replace(/\\'/g, "'")
  books[number] = typeof english[french] === 'string' ? english[french] : french
}
if (books[1] !== 'Genesis' || books[66] !== 'Revelation') {
  throw new Error(`Unexpected book names: ${books[1]}, ${books[66]}`)
}
const chapter = typeof english.Chapitre === 'string' ? english.Chapitre : 'Chapter'

const fonts = await readdir(join(dist, 'assets/src/assets/fonts'))
const literata = fonts.find(name => name.startsWith('LiterataBook-Regular.'))
if (!literata) throw new Error('Exported font missing: LiterataBook-Regular')

const config = JSON.stringify({ api, books, chapter }).replace(/</g, '\\u003c')
const renderer = (await readFile(join(root, 'scripts/web-first-screen.js'), 'utf8')).replace(
  '__FIRST_SCREEN_CONFIG__',
  config
)
const fontFace = `<style>@font-face{font-family:"Literata Book";src:url(/assets/src/assets/fonts/${literata}) format("opentype");font-display:swap}</style>`

const indexPath = join(dist, 'index.html')
const html = await readFile(indexPath, 'utf8')
const marker = '<!-- first-screen -->'
if (!html.includes(marker)) throw new Error('index.html has no first-screen marker')
await writeFile(
  indexPath,
  html.replace('</head>', `${fontFace}</head>`).replace(marker, `<script>${renderer}</script>`)
)
console.log(`First screen: ${Object.keys(books).length} books, chapters from ${api}`)
