import { usesCyberJudahEditorial } from '~helpers/editorialProfile'
export const getTimelineImageUri = (uri?: string, size: 'thumbnail' | 'original' = 'thumbnail') => {
  if (!uri) return undefined
  if (/^https?:\/\//.test(uri)) return uri
  // CyberJudah's timeline names its own pictures by address; it never reads Bible Strong's host.
  if (usesCyberJudahEditorial()) return undefined

  // Our media host serves a WebP copy of every image of the timeline at two widths (ADR-0080).
  const width = size === 'original' ? 1200 : 480
  return `https://media.bible-strong.app/timeline-images/w${width}/${encodeURIComponent(uri)}.webp`
}
