// A study (a Quill Delta) as Markdown: what we publish on cyberjudah.io and print as a PDF on the
// phone. Headings, bold, italics, lists, quotes and links stay; a Scripture block becomes a quote
// with its reference; a Strong's block its word, number and definition; a linked entity its title
// and description; a divider a rule. The reader's own words are escaped, so they stay words.

type Attributes = Record<string, unknown>
type Op = { insert?: unknown; attributes?: Attributes }
type Line = { text: string; attributes: Attributes }

const str = (value: unknown) =>
  typeof value === 'string' ? value : value == null ? '' : String(value)
const record = (value: unknown): Attributes =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Attributes) : {}

/** Markdown's own marks in the reader's text are kept as text. */
export const escapeMarkdown = (text: string) => text.replace(/([\\`*_[\]<>|~])/g, '\\$1')
const escapeLineStart = (text: string) =>
  text.replace(
    /^(\s*)([#>+-]|\d+[.)])(?=\s|$)/,
    (_m, space: string, mark: string) => `${space}\\${mark}`
  )

const inline = (text: string, attributes: Attributes = {}) => {
  if (!text) return ''
  let out = escapeMarkdown(text)
  // Emphasis cannot wrap the spaces around it, so they stay outside the marks.
  const [, lead, core, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(out) ?? ['', '', out, '']
  out = core
  if (out) {
    if (attributes.bold) out = `**${out}**`
    if (attributes.italic) out = `*${out}*`
    if (attributes.strike) out = `~~${out}~~`
    const link = str(attributes.link)
    if (/^https?:\/\//i.test(link)) out = `[${out}](${link.replace(/[()\s]/g, encodeURIComponent)})`
    const verse = record(attributes['inline-verse'])
    if (str(verse.title)) out = `${out} (${escapeMarkdown(str(verse.title))})`
    const strong = record(attributes['inline-strong'])
    const code = str(strong.codeStrong)
    if (code) out = `${out} (Strong's ${escapeMarkdown(code)})`
  }
  return `${lead}${out}${trail}`
}

const quote = (text: string) =>
  text
    .split('\n')
    .map(line => (line.trim() ? `> ${line}` : '>'))
    .join('\n')

const embed = (value: Attributes): string | null => {
  if (value.divider !== undefined) return '---'
  const verse = value['block-verse']
  if (verse) {
    const v = record(verse)
    const head = [str(v.title), str(v.version)].filter(Boolean).map(escapeMarkdown).join(' · ')
    const body = escapeMarkdown(str(v.content).trim())
    return quote([head && `**${head}**`, body].filter(Boolean).join('\n\n'))
  }
  const strong = value['block-strong']
  if (strong) {
    const s = record(strong)
    const head = [
      str(s.title),
      str(s.original),
      str(s.codeStrong) && `Strong's ${str(s.codeStrong)}`,
    ]
      .filter(Boolean)
      .map(escapeMarkdown)
      .join(' · ')
    const sound = str(s.phonetique) ? `*${escapeMarkdown(str(s.phonetique))}*` : ''
    const definition = escapeMarkdown(stripTags(str(s.definition)).trim())
    return quote([head && `**${head}**`, sound, definition].filter(Boolean).join('\n\n'))
  }
  const entity = value['block-entity']
  if (entity) {
    const display = record(record(entity).display)
    const head = [str(display.typeLabel), str(display.title)]
      .filter(Boolean)
      .map(escapeMarkdown)
      .join(': ')
    const body = [str(display.subtitle), str(display.description)]
      .filter(Boolean)
      .map(escapeMarkdown)
    return quote([head && `**${head}**`, ...body].filter(Boolean).join('\n\n'))
  }
  return null
}

/** Strong's definitions arrive as HTML: only their words are kept. */
const stripTags = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')

const lineMarkdown = (line: Line, index: number) => {
  const text = escapeLineStart(line.text)
  const header = Number(line.attributes.header)
  if (header >= 1 && header <= 6) return `${'#'.repeat(Math.min(header + 1, 6))} ${text.trim()}`
  if (line.attributes.list === 'ordered') return `${index}. ${text}`
  if (
    line.attributes.list === 'bullet' ||
    line.attributes.list === 'unchecked' ||
    line.attributes.list === 'checked'
  )
    return `- ${text}`
  if (line.attributes.blockquote) return quote(text)
  return text
}

/** The study's content as Markdown. */
export function studyMarkdown(content: { ops?: unknown } | null | undefined): string {
  const ops = Array.isArray(content?.ops) ? (content!.ops as Op[]) : []
  const blocks: { markdown: string; list?: string }[] = []
  let current = ''
  let ordered = 0

  const endLine = (attributes: Attributes) => {
    const list = str(attributes.list) || undefined
    ordered = list === 'ordered' ? ordered + 1 : 0
    blocks.push({ markdown: lineMarkdown({ text: current, attributes }, ordered), list })
    current = ''
  }

  for (const op of ops) {
    if (typeof op?.insert === 'string') {
      const parts = op.insert.split('\n')
      parts.forEach((part, i) => {
        if (i > 0) endLine(op.attributes ?? {})
        current += inline(part, op.attributes)
      })
    } else if (op?.insert && typeof op.insert === 'object') {
      const markdown = embed(op.insert as Attributes)
      if (markdown === null) continue
      if (current.trim()) endLine({})
      current = ''
      ordered = 0
      blocks.push({ markdown })
    }
  }
  if (current.trim()) endLine({})

  // Lines of one list stay together; every other block is its own paragraph.
  let out = ''
  blocks.forEach((block, i) => {
    if (!block.markdown.trim()) return
    const previous = blocks[i - 1]
    const sameList = block.list && previous?.list === block.list && previous.markdown.trim()
    out += out ? (sameList ? '\n' : '\n\n') : ''
    out += block.markdown
  })
  return out.trim() + (out.trim() ? '\n' : '')
}
