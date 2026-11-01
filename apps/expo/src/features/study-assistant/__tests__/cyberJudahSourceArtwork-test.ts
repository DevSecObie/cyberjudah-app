import { sourceArtworkUrl, sourceThumbnails } from '../cyberJudahSourceArtwork'

it('uses the cited recording with Telegram’s JPEG fallback, including when reopening old chats', () => {
  expect(sourceThumbnails({ video: 'abcdefghijk' })).toEqual([
    'https://i.ytimg.com/vi_webp/abcdefghijk/mqdefault.webp',
    'https://i.ytimg.com/vi/abcdefghijk/mqdefault.jpg',
  ])
})

it('keeps actual supplied artwork and does not invent a picture for text-only sources', () => {
  expect(sourceThumbnails({ thumb: '/img/books/example.jpg' })).toEqual([
    'https://cyberjudah.io/img/books/example.jpg',
  ])
  expect(sourceThumbnails({})).toEqual([])
})

it.each([
  'javascript:alert(1)',
  'data:image/png;base64,AA',
  'file:///private/file',
  'http://cyberjudah.io/a.jpg',
  '//untrusted.test/a.jpg',
  'https://cyberjudah.io.untrusted.test/a.jpg',
  'https://user:password@cyberjudah.io/a.jpg',
  'https://cyberjudah.io:444/a.jpg',
  'not-a-url',
])('rejects untrusted or credential-bearing artwork: %s', value => {
  expect(sourceArtworkUrl(value)).toBeUndefined()
})

it('does not construct an image request from an invalid video identifier', () => {
  expect(sourceThumbnails({ video: '../not-a-video' })).toEqual([])
})
