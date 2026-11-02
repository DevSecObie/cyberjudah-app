import { DomUtils, parseDocument } from 'htmlparser2'
import { hasChildren, isComment, isTag, isText, type AnyNode } from 'domhandler'
import type { MixedStyleDeclaration } from '@native-html/render'
import { scaleFontSize } from '~features/bible/BibleDOM/scaleFontSize'
import { scaleLineHeight } from '~features/bible/BibleDOM/scaleLineHeight'
import { webFontFamily } from '~helpers/webFontFamily'

export type ReadingTypography = { fontFamily: string; fontSize: number; lineHeight: number }
export type ReadingColors = { background: string; text: string; link: string; emphasis: string }
export type HtmlEngine = 'native' | 'dom'
export const getReadingTypography = (
  fontFamily: string,
  scale: number,
  lineHeight: 'small' | 'normal' | 'large'
): ReadingTypography => ({
  fontFamily,
  fontSize: Number.parseFloat(scaleFontSize(19, scale)),
  lineHeight: Number.parseFloat(scaleLineHeight(32, lineHeight, scale)),
})
export const defaultReadingTypography = getReadingTypography('Literata Book', 0, 'normal')

const blockedTags = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'link',
  'meta',
  'base',
  'form',
  'svg',
  'math',
])
/** Classes of the blocks that open and close a text, whose outer margins a card drops. */
export const readingEdgeClasses = { first: 'reading-first', last: 'reading-last' } as const

// Marks the first (or last) block of a text and, inside it, its own first (or last) block: the
// margins of all of them would otherwise stack at the edge of the card.
const markEdge = (nodes: AnyNode[], className: string, fromEnd: boolean) => {
  const edge = (fromEnd ? [...nodes].reverse() : nodes).find(
    node => !isComment(node) && !(isText(node) && !node.data.trim())
  )
  if (!edge || !isTag(edge)) return
  edge.attribs.class = [edge.attribs.class, className].filter(Boolean).join(' ')
  markEdge(edge.children, className, fromEnd)
}

/**
 * One HTML contract for both engines: preserve text/links, discard active markup and inline
 * styles. `trimEdges` marks the opening and closing blocks with `readingEdgeClasses`.
 */
export function cleanReadingHTML(html: string, { trimEdges = false } = {}): string {
  const document = parseDocument(html)
  const clean = (nodes: AnyNode[]) => {
    for (const node of [...nodes]) {
      // Compatibility with published commentary containing double-encoded NBSPs.
      // The parser has decoded one layer; repair only spaces in text nodes.
      if (isText(node)) {
        node.data = node.data.replace(/&(?:nbsp|#0*160|#x0*a0);/giu, '\u00a0')
      }
      if (isTag(node)) {
        if (blockedTags.has(node.name)) {
          DomUtils.removeElement(node)
          continue
        }
        for (const [key, value] of Object.entries(node.attribs)) {
          const name = key.toLowerCase()
          if (
            name.startsWith('on') ||
            ['srcdoc', 'style', 'id'].includes(name) ||
            (['href', 'src', 'xlink:href'].includes(name) &&
              /^(javascript|vbscript|data):/i.test(value.replace(/[\s\u0000-\u001f]/g, '')))
          )
            delete node.attribs[key]
        }
      }
      if (hasChildren(node)) clean(node.children)
    }
  }
  clean(document.children)
  const body = DomUtils.findOne(node => node.name === 'body', document.children, true)
  const root = body ?? document
  if (trimEdges) {
    markEdge(root.children, readingEdgeClasses.first, false)
    markEdge(root.children, readingEdgeClasses.last, true)
  }
  return DomUtils.getInnerHTML(root)
}

export function readingHtmlStyles(
  typography: ReadingTypography,
  colors: ReadingColors
): Record<string, MixedStyleDeclaration> {
  const paragraph = { marginTop: typography.fontSize, marginBottom: typography.fontSize }
  return {
    p: paragraph,
    a: { color: colors.link, textDecorationLine: 'underline', textDecorationColor: colors.link },
    strong: { color: colors.emphasis, fontWeight: 'bold' },
    b: { color: colors.emphasis, fontWeight: 'bold' },
    bold: { color: colors.emphasis, fontWeight: 'bold' },
    em: { fontStyle: 'italic' },
    i: { fontStyle: 'italic' },
    ul: { marginTop: 0, marginBottom: 0, paddingLeft: 0, listStyleType: 'none' },
    ol: { ...paragraph, paddingLeft: typography.fontSize * 2 },
    h1: {
      fontSize: typography.fontSize * 2,
      lineHeight: typography.lineHeight * 2,
      fontWeight: 'bold',
      ...paragraph,
    },
    h2: {
      fontSize: typography.fontSize * 1.5,
      lineHeight: typography.lineHeight * 1.5,
      fontWeight: 'bold',
      ...paragraph,
    },
    h3: {
      fontSize: typography.fontSize * 1.17,
      lineHeight: typography.lineHeight * 1.17,
      fontWeight: 'bold',
      ...paragraph,
    },
    blockquote: { ...paragraph, marginLeft: 24, marginRight: 24 },
  }
}

/** A colour's red, green and blue, from rgb(…)/rgba(…) or #rrggbb. */
const channels = (color: string): [number, number, number] | undefined => {
  const rgb = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color)
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(color)
  return hex ? [parseInt(hex[1], 16), parseInt(hex[2], 16), parseInt(hex[3], 16)] : undefined
}
const isLight = (color: string) => {
  const c = channels(color)
  return !c || (c[0] * 299 + c[1] * 587 + c[2] * 114) / 1000 > 140
}
/** The text colour faded toward the page, for the quieter lines of an entry. */
const muted = (colors: ReadingColors) => {
  const text = channels(colors.text)
  const page = channels(colors.background)
  if (!text || !page) return colors.text
  const mix = text.map((value, i) => Math.round(value * 0.62 + page[i] * 0.38))
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`
}

/**
 * The CyberJudah commentary's own parts, by class: the verse number and the verse words a
 * point opens on in gold (as in the class notes), scripture he quotes in gold too and Christ's
 * words in red (Obie, 2026-11-02), a precept set off by a gold rule with its scripture, and the
 * class line closing each entry.
 */
export function readingHtmlClassStyles(
  typography: ReadingTypography,
  colors: ReadingColors
): Record<string, MixedStyleDeclaration> {
  const gold = isLight(colors.background) ? '#8A5A12' : '#E0A64A'
  // The same red as the Bible reader's words of Christ.
  const red = isLight(colors.background) ? '#CC0000' : '#FF6B6B'
  const small = Math.round(typography.fontSize * 0.8)
  return {
    'cj-vno': { color: gold, fontWeight: 'bold', fontSize: small },
    'cj-verse': { color: gold, fontStyle: 'italic' },
    'cj-scripture': { color: gold, fontStyle: 'italic' },
    'cj-christ': { color: red, fontStyle: 'italic' },
    'cj-precept': {
      borderWidth: 0,
      borderLeftWidth: 2,
      borderLeftColor: gold,
      borderStyle: 'solid',
      paddingLeft: 14,
      marginTop: Math.round(typography.fontSize * 0.5),
      marginBottom: Math.round(typography.fontSize * 0.5),
    },
    'cj-label': { marginTop: 0, marginBottom: Math.round(typography.fontSize * 0.4) },
    'cj-kjv': {
      color: gold,
      fontStyle: 'italic',
      marginTop: 0,
      marginBottom: Math.round(typography.fontSize * 0.4),
    },
    'cj-cite': {
      color: muted(colors),
      fontSize: small,
      lineHeight: Math.round(typography.lineHeight * 0.8),
      borderWidth: 0,
      borderTopWidth: 1,
      borderTopColor: muted(colors),
      borderStyle: 'solid',
      paddingTop: Math.round(typography.fontSize * 0.6),
    },
  }
}

// Average glyph width of the reading fonts, relative to the font size.
const AVERAGE_CHAR_WIDTH_RATIO = 0.5

/** Rough height of rendered HTML, reserved before the DOM engine reports its measured size. */
export function estimateReadingHtmlHeight(
  html: string,
  typography: ReadingTypography,
  width: number
): number {
  const charsPerLine = Math.max(
    1,
    Math.floor(width / (typography.fontSize * AVERAGE_CHAR_WIDTH_RATIO))
  )
  const lines = html
    .replace(/<\/(p|li|h[1-6]|div|blockquote)>|<br\s*\/?>/giu, '\n')
    .replace(/<[^>]*>/gu, '')
    .replace(/&[a-z0-9#]+;/giu, ' ')
    .split('\n')
    .map(block => block.trim())
    .filter(Boolean)
    .reduce((total, block) => total + Math.ceil(block.length / charsPerLine), 0)
  const paragraphs = html.match(/<p[\s>]/giu)?.length ?? 0
  return Math.ceil(lines * typography.lineHeight + paragraphs * typography.fontSize)
}

export function readingHtmlCSS(
  typography: ReadingTypography,
  colors: ReadingColors,
  selector = '.editorial-html'
): string {
  const rules = {
    ...readingHtmlStyles(typography, colors),
    ...Object.fromEntries(
      Object.entries(readingHtmlClassStyles(typography, colors)).map(([name, styles]) => [
        `.${name}`,
        styles,
      ])
    ),
  }
  return Object.entries(rules)
    .map(([tag, styles]) => {
      const declarations = Object.entries(styles)
        .map(([key, value]) => {
          const property = key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)
          return `${property}: ${typeof value === 'number' ? `${value}px` : value}`
        })
        .join('; ')
      return `${selector} ${tag} { ${declarations}; }`
    })
    .concat(
      `${selector} .${readingEdgeClasses.first} { margin-top: 0; }`,
      `${selector} .${readingEdgeClasses.last} { margin-bottom: 0; }`
    )
    .join('\n')
}

/** The native engine's counterpart of the edge rules of `readingHtmlCSS`. */
export const readingEdgeStyles = {
  [readingEdgeClasses.first]: { marginTop: 0 },
  [readingEdgeClasses.last]: { marginBottom: 0 },
}
export { webFontFamily }
