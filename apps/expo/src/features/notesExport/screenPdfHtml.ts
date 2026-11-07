import { parseDocument } from 'htmlparser2'
import type { NoteBlock } from '~features/passageMediaLibrary/cyberJudahClasses'
import type { Theme } from '~themes/ThemeProvider'
import { noteColors } from '~features/passageMediaLibrary/noteColors'
import { longDate } from './longDate'
import type { PersonalNotePdfEntry, PublishedNote } from './notePdf'

export const escapePdfHtml = (value: unknown): string =>
  String(value ?? '').replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  )

// Export content is data, never executable HTML. Keep formatting and safe destinations only.
export const safePdfUrl = (value: string): string => {
  if (value.startsWith('/')) return `https://cyberjudah.io${value}`
  return /^(https?:\/\/|bible:\/\/|data:image\/(?:png|jpeg|webp);base64,)/i.test(value) ? value : ''
}

type HtmlNode = {
  type: string
  name?: string
  data?: string
  attribs?: Record<string, string>
  children?: HtmlNode[]
}
export function pdfInline(html: string): string {
  const tree = parseDocument(html, { decodeEntities: true }) as unknown as HtmlNode
  const render = (node: HtmlNode): string => {
    if (node.type === 'text') return escapePdfHtml(node.data)
    const tag = node.name ?? ''
    if (['script', 'style', 'iframe', 'object', 'template'].includes(tag)) return ''
    const body = (node.children ?? []).map(render).join('')
    if (tag === 'br') return '<br>'
    if (['b', 'strong', 'em', 'i', 'u', 's', 'sup', 'sub', 'code'].includes(tag))
      return `<${tag}>${body}</${tag}>`
    if (tag === 'a') {
      const href = safePdfUrl(node.attribs?.href ?? '')
      return href ? `<a href="${escapePdfHtml(href)}">${body}</a>` : body
    }
    return body
  }
  return render(tree)
}

export const pdfPalette = (theme: Theme) => ({
  ...noteColors(theme),
  background: theme.colors.reverse,
})

type PdfChip = { name: string; image?: string }
export type ClassPdfDetails = {
  people: PdfChip[]
  places: PdfChip[]
  topics: string[]
  verseChips: Record<string, PdfChip[]>
}
const chipsHtml = (chips: PdfChip[], onCard = false) =>
  chips.length
    ? `<div class="chips${onCard ? ' on-card' : ''}">${chips.map(chip => `<span class="chip">${chip.image && /^(https?:|file:|data:image\/)/.test(chip.image) ? `<img src="${escapePdfHtml(chip.image)}" alt="">` : ''}${escapePdfHtml(chip.name)}</span>`).join('')}</div>`
    : ''

/** Same ordered block tree as ClassNotesList; no separate Markdown interpretation. */
export function noteBlocksPdfHtml(blocks: NoteBlock[], details?: ClassPdfDetails): string {
  return blocks
    .map(block => {
      switch (block.type) {
        case 'heading':
          return `<h${block.level}>${pdfInline(block.html)}</h${block.level}>`
        case 'paragraph':
          return `<p class="${block.variant ?? ''}">${block.lead ? `<span class="verse-lead">${pdfInline(block.lead)}</span> ` : ''}${pdfInline(block.html)}</p>`
        case 'rule':
          return '<hr>'
        case 'quote':
          return `<blockquote>${noteBlocksPdfHtml(block.blocks, details)}</blockquote>`
        case 'reading':
          return `<section class="reading">${noteBlocksPdfHtml(block.blocks, details)}</section>`
        case 'aside':
          return `<aside><h3>${escapePdfHtml(block.label)}</h3>${noteBlocksPdfHtml(block.blocks, details)}</aside>`
        case 'list':
          return `<ul>${block.items.map(item => `<li>${noteBlocksPdfHtml(item, details)}</li>`).join('')}</ul>`
        case 'image': {
          const src = safePdfUrl(block.uri)
          return src ? `<figure><img src="${escapePdfHtml(src)}" alt=""></figure>` : ''
        }
        case 'shown': {
          const src = safePdfUrl(block.sheet)
          return `<figure><div class="shown-frame" style="background-image:url('${escapePdfHtml(src)}');background-position:${block.x}% ${block.y}%"></div><figcaption><a href="${escapePdfHtml(safePdfUrl(block.href))}">${escapePdfHtml(block.label)}</a></figcaption></figure>`
        }
        case 'verse':
          return `<section class="verse-card"><header><strong>${escapePdfHtml(block.title)}</strong> <span class="muted">KJV</span>${block.seek ? ` <a class="time" href="${escapePdfHtml(safePdfUrl(block.seek.href))}">${escapePdfHtml(block.seek.label)}</a>` : ''}</header><div class="verse-words">${noteBlocksPdfHtml(block.blocks, details)}</div>${chipsHtml(details?.verseChips[block.target ?? ''] ?? [], true)}</section>`
      }
    })
    .join('')
}

export function screenPdfDocument(title: string, body: string, theme: Theme): string {
  const c = pdfPalette(theme)
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: http: data:; style-src 'unsafe-inline'; font-src data:;"><title>${escapePdfHtml(title)}</title><style>
  @page { size:letter; margin:36pt; }
  * { box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  html,body { background:${c.background}; color:${c.text}; }
  body { margin:0; font:17px/1.59 -apple-system,BlinkMacSystemFont,Arial,sans-serif; overflow-wrap:anywhere; }
  h1 { font-size:24px; line-height:1.25; } h2 { font-size:22px; } h3 { font-size:19px; }
  h1,h2,h3,h4,header { break-after:avoid; } p { margin:0 0 12px; orphans:3; widows:3; }
  a { color:${c.link}; text-decoration:none; } .muted,.label,figcaption { color:${c.muted}; }
  .label { font-size:12px; font-weight:700; text-transform:uppercase; } .verse-lead { color:${c.verse}; font-style:italic; }
  .verse-card { background:rgba(89,131,240,.08); border-radius:10px; padding:14px 16px; margin:16px 0; }
  .verse-words { font-style:italic; } .time { background:${c.surface}; border-radius:999px; padding:5px 9px; font-size:13px; }
  blockquote { margin:0 0 14px; border-left:3px solid ${c.border}; padding-left:12px; }
  .reading,aside { border:1px solid ${c.border}; border-radius:12px; padding:14px 16px; margin-bottom:16px; }
  hr { border:0; border-top:1px solid ${c.border}; margin:16px 0; } ul,ol { padding-left:22px; }
  figure { margin:12px 0; break-inside:avoid; } img { max-width:100%; height:auto; } .shown-frame { width:100%; aspect-ratio:16/9; background-size:300% 300%; }
  .personal-note { white-space:pre-wrap; } .note-meta { font-size:14px; color:${c.muted}; margin-bottom:16px; }
  .study-body { white-space:normal; } .study-body p { white-space:pre-wrap; }
  .study-embed { color:rgb(48,51,107); background:rgba(89,131,240,.06); border-radius:10px; padding:10px; margin:12px 0; }
  .inline-verse { color:rgb(48,51,107); } .inline-strong { color:rgb(9,132,227); }
  .chips { margin:8px 0 16px; } .chip { display:inline-flex; align-items:center; gap:8px; margin:0 8px 8px 0; padding:3px 12px 3px 3px; border-radius:12px; background:${theme.colors.lightGrey}; font-size:14px; font-weight:600; break-inside:avoid; }
  .chip img { width:32px; height:32px; border-radius:8px; object-fit:cover; } .on-card .chip { background:${c.surface}; } .topic { padding:9px 14px; font-weight:400; background:${c.surface}; } .topic::before { content:'●'; color:${c.link}; margin-right:8px; }
  table { border-collapse:collapse; width:100%; } td,th { border:1px solid ${c.border}; padding:6px; }
  </style></head><body>${body}</body></html>`
}

export function classScreenPdfHtml(
  note: PublishedNote,
  blocks: NoteBlock[],
  theme: Theme,
  details?: ClassPdfDetails
): string {
  const meta = [note.date ? longDate(note.date) : '', note.teacher].filter(Boolean).join(' · ')
  const header = details
    ? [
        details.people.length
          ? `<div class="muted">People in this class</div>${chipsHtml(details.people)}`
          : '',
        details.places.length ? `<div class="muted">Places</div>${chipsHtml(details.places)}` : '',
        details.topics.length
          ? `<div class="muted">Topics</div><div class="chips">${details.topics.map(topic => `<span class="chip topic">${escapePdfHtml(topic)}</span>`).join('')}</div>`
          : '',
      ].join('')
    : ''
  return screenPdfDocument(
    note.title ?? 'Class notes',
    `<h1>${escapePdfHtml(note.title)}</h1><p class="note-meta">${escapePdfHtml(meta)}</p>${header}${noteBlocksPdfHtml(blocks, details)}`,
    theme
  )
}

export function personalScreenPdfHtml(
  entries: PersonalNotePdfEntry[],
  title: string,
  theme: Theme
): string {
  return screenPdfDocument(
    title,
    entries
      .map(
        entry =>
          `<section><h1>${escapePdfHtml(entry.title || entry.reference)}</h1><p class="note-meta">${escapePdfHtml(entry.reference)}${Number.isFinite(entry.date) ? ` · ${escapePdfHtml(new Date(entry.date).toLocaleDateString())}` : ''}</p><div class="personal-note">${escapePdfHtml(entry.text)}</div></section>`
      )
      .join('<hr>'),
    theme
  )
}
