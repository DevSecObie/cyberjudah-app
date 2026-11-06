import { baseTheme } from '~themes'
import { noteColors } from '~features/passageMediaLibrary/noteColors'
import {
  classScreenPdfHtml,
  noteBlocksPdfHtml,
  personalScreenPdfHtml,
  pdfInline,
} from '../screenPdfHtml'
import { studyScreenPdfHtml } from '../studyScreenPdfHtml'

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }))

describe('screen-faithful PDF content', () => {
  it('uses the reader palette and retains verse leads, cards, frames and images', () => {
    const html = classScreenPdfHtml(
      { title: 'Class' },
      [
        { type: 'paragraph', html: 'explanation', lead: 'verse words' },
        {
          type: 'verse',
          title: 'Genesis 1:1',
          target: 'GEN.1.1',
          blocks: [{ type: 'paragraph', html: 'In the beginning' }],
        },
        { type: 'image', uri: 'https://data.cyberjudah.io/art.png' },
        {
          type: 'shown',
          sheet: 'https://data.cyberjudah.io/sheet.jpg',
          x: 50,
          y: 100,
          seconds: 65,
          label: '1:05',
          href: 'https://youtube.com/watch?v=test&t=65s',
        },
      ],
      baseTheme
    )
    expect(html).toContain(noteColors(baseTheme).verse)
    expect(html).toContain(baseTheme.colors.primary)
    expect(html).toContain('verse-lead">verse words')
    expect(html).toContain('verse-card')
    expect(html).toContain('In the beginning')
    expect(html).toContain('art.png')
    expect(html).toContain('background-size:300% 300%')
    expect(html).toContain('background-position:50% 100%')
    expect(html).toContain('print-color-adjust:exact')
  })
  it('retains plain note text, line breaks and Unicode without interpreting markup', () => {
    const html = personalScreenPdfHtml(
      [
        {
          title: 'My note',
          reference: 'John 1',
          date: 0,
          text: '<script>words</script>\nשלום λόγος ✓',
        },
      ],
      'Notes',
      baseTheme
    )
    expect(html).toContain('&lt;script&gt;words&lt;/script&gt;\nשלום λόγος ✓')
    expect(html).toContain('white-space:pre-wrap')
  })
  it('retains study text colors, highlights, underline, alignment and Unicode', () => {
    const html = studyScreenPdfHtml(
      {
        title: 'Study',
        content: {
          ops: [
            {
              insert: 'שלום λόγος',
              attributes: { color: '#e60000', background: '#ffff00', underline: true, bold: true },
            },
            { insert: '\n', attributes: { align: 'center' } },
            { insert: { 'block-verse': { title: 'John 1', content: 'The Word', version: 'KJV' } } },
          ],
        },
      },
      baseTheme
    )
    expect(html).toContain('color:#e60000')
    expect(html).toContain('background-color:#ffff00')
    expect(html).toContain('text-align:center')
    expect(html).toContain('<u>')
    expect(html).toContain('שלום λόγος')
    expect(html).toContain('The Word')
  })
  it('keeps formatting without executable HTML or unsafe links', () => {
    expect(pdfInline('<b>safe</b><script>bad()</script><a href="javascript:bad()">words</a>')).toBe(
      '<b>safe</b>words'
    )
    expect(noteBlocksPdfHtml([{ type: 'image', uri: 'javascript:bad()' }])).toBe('')
    const html = studyScreenPdfHtml(
      {
        title: '<script>title</script>',
        content: {
          ops: [{ insert: '<img onerror=bad()>', attributes: { link: 'javascript:bad()' } }],
        },
      },
      baseTheme
    )
    expect(html).not.toContain('<script>title')
    expect(html).not.toContain('href="javascript:')
    expect(html).not.toContain('<img onerror=')
  })
})
