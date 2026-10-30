// Build the precept and law tags on verses (src/assets/cyberjudah/verse-tags.json) from the
// published precepts and Handbook of the Law on data.cyberjudah.io.
// Usage: node scripts/build-cyberjudah-verse-tags.mjs
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const ORIGIN = 'https://data.cyberjudah.io'
const output = resolve(import.meta.dirname, '../src/assets/cyberjudah/verse-tags.json')

const get = async path => {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(`${ORIGIN}${path}`, { headers: { accept: 'application/json' } })
    if (response.ok) return response.json()
    if (attempt >= 4) throw new Error(`${path}: ${response.status}`)
    await new Promise(done => setTimeout(done, 1000 * (attempt + 1)))
  }
}
const inBatches = async (items, load, size = 8) => {
  const out = []
  for (let i = 0; i < items.length; i += size)
    out.push(...(await Promise.all(items.slice(i, i + size).map(load))))
  return out
}
// "27-28" → 27, 28; "1,26" → 1, 26
const versesOf = ref =>
  String(ref.verses ?? '')
    .split(',')
    .flatMap(part => {
      const match = /^\s*(\d+)(?:-(\d+))?\s*$/.exec(part)
      if (!match) return []
      const from = Number(match[1])
      const to = Math.min(Number(match[2] ?? from), from + 200)
      return Array.from({ length: to - from + 1 }, (_, i) => from + i)
    })

const precepts = await inBatches(await get('/api/precepts/index.json'), row =>
  get(`/api/precepts/${row.slug}.json`)
)
const sections = (await get('/api/laws/index.json')).flatMap(part => part.sections.map(s => s.id))
const laws = await inBatches(sections, id => get(`/api/laws/${id}.json`))

const tags = {}
const chapters = {}
const add = (key, ref) => {
  const chapter = (chapters[`${ref.slug}/${ref.chapter}`] ??= {})
  for (const verse of versesOf(ref)) (chapter[verse] ??= new Set()).add(key)
}
for (const precept of precepts) {
  tags[`p:${precept.slug}`] = precept.title
  for (const ref of precept.refs) add(`p:${precept.slug}`, ref)
}
for (const section of laws) {
  for (const entry of section.entries) {
    tags[`l:${entry.id}`] = entry.id
    for (const ref of entry.refs) add(`l:${entry.id}`, ref)
  }
}
const sorted = Object.fromEntries(
  Object.entries(chapters).map(([chapter, verses]) => [
    chapter,
    Object.fromEntries(Object.entries(verses).map(([verse, keys]) => [verse, [...keys].sort()])),
  ])
)
await writeFile(output, JSON.stringify({ tags, chapters: sorted }))
console.log(`${Object.keys(tags).length} tags on ${Object.keys(sorted).length} chapters`)
