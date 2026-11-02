import { PDFDocument } from 'pdf-lib'
import { studyPdf } from '~features/notesExport/notePdf'
import { studyMarkdown } from '../studyMarkdown'

const content = {
  ops: [
    { insert: 'Judah in Egypt' },
    { attributes: { header: 1 }, insert: '\n' },
    { insert: 'The sons of ' },
    { attributes: { bold: true }, insert: 'Judah' },
    { insert: ' went down. ' },
    {
      attributes: { 'inline-verse': { title: 'Genesis 46:12', verses: ['1-46-12'] } },
      insert: 'See',
    },
    { insert: '\nFirst point' },
    { attributes: { list: 'ordered' }, insert: '\n' },
    { insert: 'Second point' },
    { attributes: { list: 'ordered' }, insert: '\n' },
    {
      insert: {
        'block-verse': {
          title: 'Genesis 46:12',
          content: 'And the sons of Judah; Er, and Onan, and Shelah...',
          version: 'KJV',
          verses: ['1-46-12'],
        },
      },
    },
    { insert: { divider: true } },
    {
      insert: {
        'block-strong': {
          title: 'Yehuwdah',
          codeStrong: 3063,
          phonetique: "(yeh-hoo-daw')",
          original: 'יְהוּדָה',
          definition: '<p>Judah = <b>praised</b></p>',
        },
      },
    },
    { insert: 'A <script> and [link](javascript:x) # not a heading\n' },
    { attributes: { link: 'https://cyberjudah.io/app' }, insert: 'our app' },
    { insert: '\n' },
  ],
}

describe('studyMarkdown', () => {
  const md = studyMarkdown(content)

  it('keeps headings, emphasis, lists and Scripture references', () => {
    expect(md).toContain('## Judah in Egypt')
    expect(md).toContain('The sons of **Judah** went down. See (Genesis 46:12)')
    expect(md).toContain('1. First point\n2. Second point')
    expect(md).toContain('> **Genesis 46:12 · KJV**')
    expect(md).toContain('> And the sons of Judah; Er, and Onan, and Shelah...')
    expect(md).toContain('---')
    expect(md).toContain("Strong's 3063")
    expect(md).toContain('> Judah = praised')
    expect(md).toContain('[our app](https://cyberjudah.io/app)')
  })

  it("keeps the reader's marks as text", () => {
    expect(md).toContain('A \\<script\\> and \\[link\\](javascript:x) # not a heading')
    expect(md).not.toContain('<script>')
  })

  it('is empty for an empty study', () => {
    expect(studyMarkdown(null)).toBe('')
    expect(studyMarkdown({ ops: [{ insert: '\n' }] })).toBe('')
  })

  it('prints the study as a PDF on the phone', async () => {
    const base64 = await studyPdf({
      title: 'Judah in Egypt',
      author: 'Asahel',
      modified: Date.UTC(2026, 10, 2),
      markdown: md + '\nMore words. '.repeat(500),
      link: 'https://cyberjudah.io/app/published/abc',
    })
    const doc = await PDFDocument.load(Buffer.from(base64, 'base64'))
    expect(doc.getTitle()).toBe('Judah in Egypt')
    expect(doc.getAuthor()).toBe('Asahel')
    expect(doc.getPageCount()).toBeGreaterThan(1)
  })
})
