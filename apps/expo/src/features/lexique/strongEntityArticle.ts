const plainText = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * CyberJudah's people open their article with the same sentence shown above it: the article keeps
 * only what it adds (other names, the map), and nothing when it adds nothing.
 */
export const withoutRepeatedSummary = (article: string, summary: string) => {
  const repeated = plainText(summary)
  if (!repeated || !article) return article
  const [first, ...rest] = article.split(/(?<=<\/p>)/)
  return plainText(first) === repeated ? rest.join('') : article
}
