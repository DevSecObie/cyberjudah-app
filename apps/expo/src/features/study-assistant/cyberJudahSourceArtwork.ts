import type { CyberJudahSource } from './cyberJudahAsk'

// Artwork is editorial source metadata, never an image URL guessed by the model.
export function sourceArtworkUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 2048 || /[\\\s]/.test(value)) return undefined
  if (!value.startsWith('https://') && !/^\/(?!\/)/.test(value)) return undefined
  try {
    const url = new URL(value, 'https://cyberjudah.io')
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      !['cyberjudah.io', 'www.cyberjudah.io', 'i.ytimg.com'].includes(url.hostname)
    )
      return undefined
    return url.href
  } catch {
    return undefined
  }
}

/** Match Telegram's WebP thumbnail and JPEG fallback, without fetching the source page. */
export function sourceThumbnails(source: Pick<CyberJudahSource, 'video' | 'thumb'>): string[] {
  const supplied = sourceArtworkUrl(source.thumb)
  const video = source.video && /^[A-Za-z0-9_-]{11}$/.test(source.video) ? source.video : undefined
  return [
    ...new Set([
      ...(supplied ? [supplied] : []),
      ...(video
        ? [
            `https://i.ytimg.com/vi_webp/${video}/mqdefault.webp`,
            `https://i.ytimg.com/vi/${video}/mqdefault.jpg`,
          ]
        : []),
    ]),
  ]
}
