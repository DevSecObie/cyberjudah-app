import { PDFDocument } from 'pdf-lib'
import { classNotePdf, longDate, pdfName, personalNotesPdf, prepare, stripTags } from '../notePdf'

const body = `<p class="taught">Sabbath class</p>

<span class="opens"><b>Opens</b> [Genesis 1](/bible/genesis/1) · [John 3](/bible/john/3)</span>

## The beginning *[[1:05](https://www.youtube.com/watch?v=abcdefghijk&t=65s)]*

**[Genesis 1:1](/bible/genesis/1#v1)**

> <sup><a href="/bible/genesis/1#v1">1</a></sup> In the beginning God created the heaven and the earth.

- Precepts:
  - John 1:1 In the beginning was the Word.

<div class="class-video-mount"><iframe src="https://example.com"></iframe></div>

Paragraph with **bold**, *italic* and → arrows.
`

const open = (base64: string) => PDFDocument.load(Buffer.from(base64, 'base64'))

describe('notesExport PDF', () => {
  it('makes a class note PDF with its head and every page numbered', async () => {
    const base64 = await classNotePdf({
      kind: 'class',
      title: 'In The Beginning',
      date: '2026-10-24',
      teacher: 'Deacon Isaac',
      url: '/classes/2026-10-24-in-the-beginning',
      body: body + '\nMore words. '.repeat(600),
    })
    const doc = await open(base64)
    expect(doc.getTitle()).toBe('In The Beginning')
    expect(doc.getAuthor()).toBe('Deacon Isaac')
    expect(doc.getSubject()).toBe('Sabbath class, October 24, 2026')
    expect(doc.getPageCount()).toBeGreaterThan(1)
  })

  it('drops the website-only parts and keeps the Markdown as written', () => {
    const out = prepare(body)
    expect(out).not.toContain('iframe')
    expect(out).toContain('**[Genesis 1:1](/bible/genesis/1#v1)**')
    expect(stripTags('<b>a</b> &amp;lt; b')).toBe('a &lt; b')
  })

  it('makes one PDF of the reader’s own notes, kept as plain words', async () => {
    const one = await open(
      await personalNotesPdf(
        [
          {
            title: '',
            reference: 'Genesis 1:1',
            date: Date.UTC(2026, 9, 29),
            text: '*not bold*\n\nline',
          },
        ],
        'My notes'
      )
    )
    expect(one.getTitle()).toBe('Genesis 1:1')
    const many = await open(
      await personalNotesPdf(
        Array.from({ length: 40 }, (_, i) => ({
          title: `Note ${i}`,
          reference: `John 3:${i + 1}`,
          date: Date.UTC(2026, 9, 1),
          text: 'Words of the note. '.repeat(30),
        })),
        'My notes'
      )
    )
    expect(many.getTitle()).toBe('My notes')
    expect(many.getPageCount()).toBeGreaterThan(2)
  })

  it('names the file from the date and title', () => {
    expect(pdfName({ date: '2026-10-24', title: 'In The Beginning!' })).toBe(
      '2026-10-24-in-the-beginning.pdf'
    )
    expect(longDate('2025-12-28')).toBe('December 28, 2025')
  })
})
