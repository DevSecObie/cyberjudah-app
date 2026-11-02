// Notes as PDFs, typeset like a printed study guide. A class note comes out exactly as the
// Telegram app's "Export as PDF" makes it (cyberjudah-telegram bot/src/pdf.mjs): a head with the
// collection, the date and the teacher; headings; paragraphs in a book face; quoted Scripture set
// off with a rule; lists; the class's timestamps as small grey marks; page numbers and the
// note's address at the foot. The reader's own notes use the same page, one after another.
// Pure JavaScript (pdf-lib, marked), so it runs on the phone, offline.
import { decodeHTML } from 'entities'
import { parseDocument } from 'htmlparser2'
import { marked, type Token, type Tokens } from 'marked'
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'

/** A published note, as data.cyberjudah.io serves it at /api/notes/<path>.json. */
export type PublishedNote = {
  kind?: string
  title?: string
  date?: string
  teacher?: string
  url?: string
  body?: string
}

/** One of the reader's own notes: its words are plain text, never Markdown. */
export type PersonalNotePdfEntry = {
  title: string
  /** Where it is in the Bible, e.g. "Genesis 1:1-3". */
  reference: string
  /** When it was written, in milliseconds. */
  date: number
  text: string
}

const PAGE: [number, number] = [612, 792]
const M = { left: 68, right: 68, top: 70, bottom: 70 }
const WIDTH = PAGE[0] - M.left - M.right
const INK = rgb(0.11, 0.11, 0.13)
const MUTED = rgb(0.43, 0.45, 0.5)
const ACCENT = rgb(0.0, 0.42, 0.6)
const RULE = rgb(0.82, 0.83, 0.86)
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
const COLLECTION: Record<string, string> = {
  class: 'Sabbath class',
  captains: '15 Minutes with the Captains',
  history: 'Our Hidden History',
  study: 'Study note',
  encyclopedia: 'Encyclopedia',
}
const SITE = 'https://cyberjudah.io'
const MOMENT = /^\d{1,2}:\d{2}(?::\d{2})?$/
const HIDDEN = new Set(['script', 'style', 'iframe', 'object', 'template'])

/** 2025-12-28 as "December 28, 2025". */
export const longDate = (iso?: string | null) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '')
  return m ? `${MONTHS[+m[2] - 1]} ${+m[3]}, ${m[1]}` : ''
}

const isoDay = (time: number) => {
  const d = new Date(time)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

type DomNode = {
  type: string
  name?: string
  data?: string
  attribs?: Record<string, string>
  children?: DomNode[]
  startIndex: number | null
  endIndex: number | null
}

/** Removes the website-only parts of a note (videos, scripts, figures), keeping its Markdown as written. */
export function prepare(md: string) {
  const source = String(md ?? '')
  const tree = parseDocument(source, {
    decodeEntities: false,
    withStartIndices: true,
    withEndIndices: true,
  }) as unknown as DomNode
  const ranges: [number, number][] = []
  const visit = (node: DomNode) => {
    const classes = new Set((node.attribs?.class ?? '').split(/\s+/))
    if (
      node.type === 'comment' ||
      HIDDEN.has(node.name ?? '') ||
      node.name === 'figure' ||
      classes.has('class-video-mount') ||
      classes.has('shown-all')
    ) {
      if (node.startIndex !== null && node.endIndex !== null)
        ranges.push([node.startIndex, node.endIndex + 1])
      return
    }
    for (const child of node.children ?? []) visit(child)
  }
  visit(tree)
  let result = ''
  let offset = 0
  for (const [start, end] of ranges) {
    result += source.slice(offset, start) + '\n'
    offset = end
  }
  result += source.slice(offset)
  return result.replace(/[ \t]+taught in \[[^\]]+\]\(\/study\/[^)]+\)/g, '')
}

/** The words of some HTML, entities decoded once; never fed back into HTML. */
export function stripTags(html: string) {
  const tree = parseDocument(String(html), { decodeEntities: true }) as unknown as DomNode
  const text = (node: DomNode): string => {
    if (HIDDEN.has(node.name ?? '') || node.type === 'comment') return ''
    if (node.type === 'text') return node.data ?? ''
    return (node.children ?? []).map(text).join(' ')
  }
  return text(tree).replace(/\s+/g, ' ').trim()
}

const unescape = (value: string) => decodeHTML(String(value))

type Run = { text: string; font: PDFFont; size?: number; color?: ReturnType<typeof rgb> }
type Style = {
  bold?: boolean
  italic?: boolean
  sans?: boolean
  size?: number
  color?: Run['color']
}

/** A US Letter document with the note page's faces, flow and Markdown blocks. */
async function createWriter(meta: { title: string; author: string; subject: string }) {
  const doc = await PDFDocument.create()
  doc.setTitle(meta.title)
  doc.setAuthor(meta.author)
  doc.setCreator('CyberJudah')
  doc.setProducer('CyberJudah')
  doc.setSubject(meta.subject)
  const F = {
    serif: await doc.embedFont(StandardFonts.TimesRoman),
    serifB: await doc.embedFont(StandardFonts.TimesRomanBold),
    serifI: await doc.embedFont(StandardFonts.TimesRomanItalic),
    serifBI: await doc.embedFont(StandardFonts.TimesRomanBoldItalic),
    sans: await doc.embedFont(StandardFonts.Helvetica),
    sansB: await doc.embedFont(StandardFonts.HelveticaBold),
  }
  // The standard faces carry the Western set only; anything else is swapped or left out.
  const known = new Set(F.serif.getCharacterSet())
  const SWAP: Record<string, string> = {
    ' ': ' ',
    '‑': '-',
    '‐': '-',
    '−': '-',
    ' ': ' ',
    ' ': ' ',
    '​': '',
    '→': '->',
    '←': '<-',
    '✓': '',
    '×': 'x',
  }
  const clean = (t: string) =>
    [...String(t)].map(ch => (known.has(ch.codePointAt(0)!) ? ch : (SWAP[ch] ?? ''))).join('')

  let page!: PDFPage
  let y = 0
  const newPage = () => {
    page = doc.addPage(PAGE)
    y = PAGE[1] - M.top
  }
  newPage()
  const need = (h: number) => {
    if (y - h < M.bottom) newPage()
  }

  /** Lays out runs of styled text inside a width, wrapping by words. */
  const flow = (
    runs: Run[],
    {
      x = M.left,
      width = WIDTH,
      size = 11.5,
      leading = 1.5,
    }: { x?: number; width?: number; size?: number; leading?: number } = {}
  ) => {
    type Word = Run & { space: boolean; w: number }
    const words: Omit<Word, 'w'>[] = []
    for (const r of runs) {
      for (const p of clean(r.text).split(/(\s+)/))
        if (p) words.push({ ...r, text: p, space: /^\s+$/.test(p) })
    }
    const lines: Word[][] = []
    let line: Word[] = []
    let w = 0
    for (const wd of words) {
      const s = wd.size ?? size
      const ww = wd.space
        ? wd.font.widthOfTextAtSize(' ', s)
        : wd.font.widthOfTextAtSize(wd.text, s)
      if (!wd.space && w + ww > width && line.length) {
        lines.push(line)
        line = []
        w = 0
      }
      if (wd.space && !line.length) continue
      line.push({ ...wd, w: ww })
      w += ww
    }
    if (line.length) lines.push(line)
    const lh = size * leading
    for (const ln of lines) {
      while (ln.length && ln[ln.length - 1].space) ln.pop()
      need(lh)
      let cx = x
      const base = y - size
      for (const wd of ln) {
        if (!wd.space)
          page.drawText(wd.text, {
            x: cx,
            y: base,
            size: wd.size ?? size,
            font: wd.font,
            color: wd.color ?? INK,
          })
        cx += wd.w
      }
      y -= lh
    }
  }

  const face = (s: Style) =>
    s.sans
      ? s.bold
        ? F.sansB
        : F.sans
      : s.bold && s.italic
        ? F.serifBI
        : s.bold
          ? F.serifB
          : s.italic
            ? F.serifI
            : F.serif

  /** Inline Markdown as runs: bold, italic, links (as their words), the class's times in grey. */
  const runsOf = (tokens: Token[] | undefined, st: Style = {}): Run[] => {
    const out: Run[] = []
    for (const t of (tokens ?? []) as (Token & { tokens?: Token[]; text?: string })[]) {
      if (t.type === 'strong') out.push(...runsOf(t.tokens, { ...st, bold: true }))
      else if (t.type === 'em') {
        // A moment of the class, "*[[19:13](…)]*", is a small grey time, not italics.
        const inner = (t.tokens ?? [])
          .map(x => (x as { text?: string }).text ?? x.raw ?? '')
          .join('')
        const time = /\[?\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*\]?/.exec(inner)
        if (time && MOMENT.test(time[1]) && inner.replace(/[[\]\s]/g, '').length <= 8)
          out.push({ text: `${time[1]}  `, font: F.sans, size: 8.5, color: MUTED })
        else out.push(...runsOf(t.tokens, { ...st, italic: true }))
      } else if (t.type === 'link') {
        if (MOMENT.test(String(t.text).trim()))
          out.push({ text: `${String(t.text).trim()}  `, font: F.sans, size: 8.5, color: MUTED })
        else out.push(...runsOf(t.tokens, st))
      } else if (t.type === 'codespan')
        out.push({ text: unescape(t.text ?? ''), font: F.sans, size: st.size, color: st.color })
      else if (t.type === 'br') out.push({ text: ' ', font: face(st) })
      else if (t.type === 'html') {
        const s = stripTags(t.raw)
        if (s) out.push({ text: s, font: face(st), color: st.color })
      } else if (t.tokens?.length) out.push(...runsOf(t.tokens, st))
      else if (t.text !== undefined || t.raw !== undefined)
        out.push({
          text: unescape(t.text ?? t.raw),
          font: face(st),
          color: st.color,
          size: st.size,
        })
    }
    return out
  }

  const rule = () => {
    need(14)
    page.drawLine({
      start: { x: M.left, y },
      end: { x: PAGE[0] - M.right, y },
      thickness: 0.75,
      color: RULE,
    })
  }

  /** The head: the library's name, the title, then what, when and who. */
  const head = (title: string, meta: string) => {
    flow([{ text: 'CYBERJUDAH', font: F.sansB, size: 8.5, color: ACCENT }], {
      size: 8.5,
      leading: 1.6,
    })
    y -= 6
    flow([{ text: title, font: F.serifB, size: 24 }], { size: 24, leading: 1.18 })
    y -= 6
    if (meta) flow([{ text: meta, font: F.sans, size: 10, color: MUTED }], { size: 10 })
    y -= 10
    rule()
    y -= 18
  }

  const block = (tokens: Token[], indent = 0) => {
    for (const t of tokens as (Token & { tokens?: Token[] })[]) {
      const x = M.left + indent
      const width = WIDTH - indent
      if (t.type === 'heading') {
        const depth = (t as Tokens.Heading).depth
        const size = depth <= 2 ? 15.5 : 12.5
        y -= depth <= 2 ? 12 : 8
        need(size * 3)
        flow(
          runsOf(t.tokens, { sans: true, bold: true }).map(r => ({ ...r, size })),
          { x, width, size, leading: 1.3 }
        )
        y -= 4
      } else if (t.type === 'paragraph' && /^\s*<span class="opens">/.test(t.raw)) {
        block([{ type: 'html', raw: t.raw, text: t.raw, block: true, pre: false }], indent)
      } else if (t.type === 'paragraph') {
        flow(runsOf(t.tokens), { x, width })
        y -= 7
      } else if (t.type === 'blockquote') {
        const top = y
        const startPage = page
        block(t.tokens ?? [], indent + 16)
        if (page === startPage)
          page.drawLine({
            start: { x: x + 3, y: top - 2 },
            end: { x: x + 3, y: y + 6 },
            thickness: 2,
            color: ACCENT,
          })
        y -= 2
      } else if (t.type === 'list') {
        const list = t as Tokens.List
        list.items.forEach((item, i) => {
          const mark = list.ordered ? `${(Number(list.start) || 1) + i}.` : '•'
          need(17)
          page.drawText(mark, { x: x + 2, y: y - 11.5, size: 11.5, font: F.serif, color: MUTED })
          const inner = item.tokens.map(k =>
            k.type === 'text' && (k as Tokens.Text).tokens ? { ...k, type: 'paragraph' } : k
          ) as Token[]
          const before = y
          block(inner, indent + 20)
          if (y === before) y -= 17
          y += 4
        })
        y -= 4
      } else if (t.type === 'hr') {
        y -= 6
        need(12)
        page.drawLine({
          start: { x, y },
          end: { x: PAGE[0] - M.right, y },
          thickness: 0.5,
          color: RULE,
        })
        y -= 12
      } else if (t.type === 'html') {
        const raw = t.raw
        if (/class="taught"/.test(raw)) continue // the head already says when and what
        if (/class="opens"/.test(raw)) {
          const refs = [...raw.matchAll(/\[([^\]]+)\]\([^)]*\)|<a[^>]*>([^<]+)<\/a>/g)].map(
            m => m[1] ?? m[2]
          )
          const more = /<i>([^<]+)<\/i>/.exec(raw)?.[1]
          if (refs.length) {
            flow(
              [
                { text: 'Scriptures opened  ', font: F.sansB, size: 9.5, color: MUTED },
                {
                  text: refs.join(' · ') + (more ? ` · ${more}` : ''),
                  font: F.sans,
                  size: 9.5,
                  color: MUTED,
                },
              ],
              { x, width, size: 9.5, leading: 1.55 }
            )
            y -= 10
          }
          continue
        }
        const text = stripTags(raw)
        if (text) {
          flow([{ text, font: F.serif }], { x, width })
          y -= 7
        }
      } else if (t.type === 'code') {
        flow([{ text: (t as Tokens.Code).text, font: F.sans, size: 10 }], { x, width, size: 10 })
        y -= 7
      } else if (t.tokens?.length) {
        flow(runsOf(t.tokens), { x, width })
        y -= 7
      }
    }
  }

  /** Plain words, line by line, as the reader typed them. */
  const plain = (text: string) => {
    const paragraphs = String(text ?? '')
      .replace(/\r/g, '')
      .split(/\n{2,}/)
    for (const paragraph of paragraphs) {
      const lines = paragraph.split('\n').filter(line => line.trim())
      if (!lines.length) continue
      for (const line of lines) flow([{ text: line, font: F.serif }])
      y -= 7
    }
  }

  /** The foot of every page: where the note lives, and the page. */
  const finish = (where: string) => {
    const pages = doc.getPages()
    const foot = clean(where)
    pages.forEach((p, i) => {
      if (foot)
        p.drawText(foot.length > 90 ? `${foot.slice(0, 88)}…` : foot, {
          x: M.left,
          y: 38,
          size: 8,
          font: F.sans,
          color: MUTED,
        })
      const label = `${i + 1} of ${pages.length}`
      p.drawText(label, {
        x: PAGE[0] - M.right - F.sans.widthOfTextAtSize(label, 8),
        y: 38,
        size: 8,
        font: F.sans,
        color: MUTED,
      })
    })
    return doc.saveAsBase64()
  }

  return {
    head,
    block,
    plain,
    finish,
    flow,
    F,
    newPage,
    gap: (h: number) => {
      y -= h
    },
    rule,
    MUTED,
  }
}

/** A published class (or study) note as a PDF, base64: the same pages Telegram's export makes. */
export async function classNotePdf(note: PublishedNote, { site = SITE } = {}) {
  const title = String(note.title ?? 'Class notes')
  const pdf = await createWriter({
    title,
    author: note.teacher || 'CyberJudah',
    subject: `${COLLECTION[note.kind ?? ''] ?? 'Note'}${note.date ? `, ${longDate(note.date)}` : ''}`,
  })
  pdf.head(
    title,
    [COLLECTION[note.kind ?? ''] ?? '', longDate(note.date), note.teacher]
      .filter(Boolean)
      .join('  ·  ')
  )
  pdf.block(marked.lexer(prepare(note.body ?? ''), { gfm: true }))
  return pdf.finish(`${site.replace(/^https?:\/\//, '')}${note.url ?? ''}`)
}

/** The reader's own notes as a PDF, base64: each note's title, passage and date, then its words. */
export async function personalNotesPdf(entries: PersonalNotePdfEntry[], heading: string) {
  const single = entries.length === 1 ? entries[0] : null
  const title = single ? single.title || single.reference : heading
  const pdf = await createWriter({ title, author: 'CyberJudah', subject: heading })
  if (single) {
    pdf.head(
      title,
      [single.title ? single.reference : '', longDate(isoDay(single.date))]
        .filter(Boolean)
        .join('  ·  ')
    )
    pdf.plain(single.text)
  } else {
    pdf.head(title, '')
    entries.forEach((entry, i) => {
      if (i) pdf.gap(10)
      pdf.flow([{ text: entry.title || entry.reference, font: pdf.F.sansB, size: 15.5 }], {
        size: 15.5,
        leading: 1.3,
      })
      const meta = [entry.title ? entry.reference : '', longDate(isoDay(entry.date))]
        .filter(Boolean)
        .join('  ·  ')
      if (meta)
        pdf.flow([{ text: meta, font: pdf.F.sans, size: 10, color: pdf.MUTED }], { size: 10 })
      pdf.gap(8)
      pdf.plain(entry.text)
    })
  }
  return pdf.finish('')
}

/** A study the reader wrote, already as Markdown (features/studies/studyMarkdown.ts), as a PDF, base64. */
export async function studyPdf(study: {
  title: string
  author?: string
  modified?: number
  markdown: string
  link?: string
}) {
  const title = study.title || 'Study'
  const pdf = await createWriter({ title, author: study.author || 'CyberJudah', subject: 'Study' })
  pdf.head(
    title,
    [study.author, study.modified ? longDate(isoDay(study.modified)) : '']
      .filter(Boolean)
      .join('  ·  ')
  )
  pdf.block(marked.lexer(study.markdown, { gfm: true }))
  return pdf.finish((study.link ?? '').replace(/^https?:\/\//, ''))
}

/** A file name from the title: letters, digits and dashes, with the date. */
export const pdfName = (note: { date?: string | null; title?: string }) =>
  `${(note.date ?? '').slice(0, 10)}-${String(note.title ?? 'note')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)}.pdf`.replace(/^-/, '')

export const personalNotesPdfName = (title: string, time = Date.now()) =>
  pdfName({ date: isoDay(time), title })
