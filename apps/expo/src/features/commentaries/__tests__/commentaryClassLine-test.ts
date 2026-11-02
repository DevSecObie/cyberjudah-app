import { splitCommentaryClassLine } from '../commentaryClassLine'

it('takes the class line out of an entry for the class card header', () => {
  const content =
    '<p><b class="cj-vno">26</b> <i class="cj-verse">Let us make man:</i> dominion is rulership.</p>' +
    '<p class="cj-cite"><a href="https://www.youtube.com/watch?v=U39hwR1pDTQ&amp;t=11247s">▶ 3:07:27</a> · ' +
    '<a href="https://cyberjudah.io/classes/x">The Negro Community: A Wasteland of Tears</a> · Jun 28, 2026</p>'
  expect(splitCommentaryClassLine(content)).toEqual({
    body: '<p><b class="cj-vno">26</b> <i class="cj-verse">Let us make man:</i> dominion is rulership.</p>',
    classTitle: 'The Negro Community: A Wasteland of Tears',
    date: 'Jun 28, 2026',
    video: { id: 'U39hwR1pDTQ', start: 11247, label: '3:07:27' },
  })
})

it('keeps an entry without a class line whole', () => {
  expect(splitCommentaryClassLine('<p>x</p>')).toEqual({ body: '<p>x</p>' })
})

it('reads a class line with no recording', () => {
  expect(
    splitCommentaryClassLine(
      '<p>x</p><p class="cj-cite"><a href="https://cyberjudah.io/c">Class</a> · Oct 31, 2026</p>'
    )
  ).toEqual({ body: '<p>x</p>', classTitle: 'Class', date: 'Oct 31, 2026', video: undefined })
})
