import { withoutRepeatedSummary } from '../strongEntityArticle'

describe('entity article without the repeated summary', () => {
  const summary = 'A son of Shem (<a href="bible://Gen.10.22">Genesis 10:22</a>)'
  it('shows nothing when the article only repeats the summary', () => {
    expect(withoutRepeatedSummary(`<p>${summary}</p>`, summary)).toBe('')
  })
  it('keeps what the article adds', () => {
    expect(withoutRepeatedSummary(`<p>${summary}</p><p>Also called Assur.</p>`, summary)).toBe(
      '<p>Also called Assur.</p>'
    )
  })
  it('leaves a different article as it is', () => {
    expect(withoutRepeatedSummary('<p>Another text.</p>', summary)).toBe('<p>Another text.</p>')
  })
})
