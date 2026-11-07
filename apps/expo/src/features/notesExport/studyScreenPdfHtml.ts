import { QuillDeltaToHtmlConverter } from 'quill-delta-to-html'
import type { Theme } from '~themes/ThemeProvider'
import {
  getStudyEntityBlockDescription,
  type StudyEntityEmbedPayload,
} from '~features/studies/studyEntityEmbeds'
import { escapePdfHtml as escape, safePdfUrl, screenPdfDocument } from './screenPdfHtml'

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
const text = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : ''

/** Use the repository's Quill converter, retaining colors, highlights, alignment and lists. */
export function studyScreenPdfHtml(
  study: { title: string; content?: { ops?: unknown } | null; user?: { displayName?: string } },
  theme: Theme,
  dark = false,
  fontFamily = 'Literata Book'
): string {
  const ops = (Array.isArray(study.content?.ops) ? study.content.ops : []).flatMap(value => {
    const op = record(value)
    const attributes = { ...record(op.attributes) }
    delete attributes.mentions
    delete attributes.mention
    const insert = record(op.insert)
    if (insert.video) return [{ insert: text(insert.video) + '\n', attributes: {} }]
    if (insert.image && !safePdfUrl(text(insert.image))) return []
    return [{ ...op, attributes }]
  })
  const converter = new QuillDeltaToHtmlConverter(ops, {
    inlineStyles: true,
    encodeHtml: true,
    customTag: format =>
      ['inline-verse', 'inline-strong', 'inline-entity'].includes(format) ? 'span' : undefined,
    customCssClasses: op => {
      const attributes = record(op.attributes)
      if (attributes['inline-verse']) return ['inline-verse']
      if (attributes['inline-strong']) return ['inline-strong']
      if (attributes['inline-entity']) {
        const endpoint = record(record(attributes['inline-entity']).endpoint)
        return [
          ['strong', 'dictionary', 'word'].includes(text(endpoint.type))
            ? 'inline-strong'
            : 'inline-verse',
        ]
      }
    },
  })
  converter.renderCustomWith(op => {
    const value = record(op.insert.value)
    if (op.insert.type === 'divider') return '<hr>'
    if (op.insert.type === 'block-verse')
      return `<div class="study-embed"><p><i>${escape(value.content)}</i></p><small>${escape(value.title)} <b>${escape(value.version)}</b></small></div>`
    if (op.insert.type === 'block-strong')
      return `<div class="study-embed"><b>${escape(value.title)}</b><div>[${escape(value.phonetique)}] - ${escape(value.code || value.codeStrong)} - ${escape(value.original)}</div></div>`
    if (op.insert.type === 'block-entity') {
      const display = record(value.display)
      const endpoint = record(value.endpoint)
      if (endpoint.type === 'verse')
        return `<div class="study-embed"><p>${escape(display.description || display.subtitle)}</p><small>${escape(display.title)} <b>${escape(display.chip || display.subtitle || endpoint.version)}</b></small></div>`
      if (endpoint.type === 'strong')
        return `<div class="study-embed"><small>${escape(display.typeLabel)}</small><h3>${escape(display.title)}</h3><div>[${escape(display.subtitle)}] - ${escape(display.chip || endpoint.code)} - ${escape(display.description)}</div></div>`
      const description = getStudyEntityBlockDescription(
        value as unknown as StudyEntityEmbedPayload
      )
      const accent =
        (
          {
            externalLink: '#ac7e00',
            study: '#62717a',
            note: '#c24553',
            dictionary: '#ffbc00',
            word: '#ffbc00',
          } as Record<string, string>
        )[text(endpoint.type)] ?? '#30336b'
      return `<div class="study-embed"><small style="color:${accent}">${escape(display.typeLabel)}</small><h3>${escape(display.title)}</h3>${description ? `<div>${escape(description)}</div>` : ''}</div>`
    }
    // Unsupported stored content must not silently disappear from an export.
    throw new Error(`Unsupported study PDF content: ${op.insert.type}`)
  })
  return screenPdfDocument(
    study.title,
    `<h1>${escape(study.title)}</h1>${study.user?.displayName ? `<p class="note-meta">${escape(study.user.displayName)}</p>` : ''}<div class="study-body" style="font-family:${escape(fontFamily.replace(/[^a-zA-Z0-9 -]/g, ''))},serif;${dark ? 'color:#000;filter:invert(1) hue-rotate(180deg);' : ''}">${converter.convert()}</div>`,
    theme
  )
}
