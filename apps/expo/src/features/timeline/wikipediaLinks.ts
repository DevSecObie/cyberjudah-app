/** Whether a link is a Wikipedia page (any language, desktop or mobile). */
export const isWikipediaUrl = (url: string) => {
  try {
    const { protocol, hostname } = new URL(url)
    return (
      (protocol === 'https:' || protocol === 'http:') &&
      (hostname === 'wikipedia.org' || hostname.endsWith('.wikipedia.org'))
    )
  } catch {
    return false
  }
}
