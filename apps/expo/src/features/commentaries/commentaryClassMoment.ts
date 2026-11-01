/** A moment in a class: the YouTube video and the second the teaching starts. */
export type ClassMoment = { videoId: string; start: number }

const MOMENT_LINK =
  /https?:\/\/(?:www\.)?youtube\.com\/watch\?v=([\w-]{11})(?:&amp;|&)t=(\d{1,6})s?/u

/** The class moment a link points at (the "1:35:20" link under a commentary entry). */
export const classMomentOf = (href: string): ClassMoment | undefined => {
  const match = href.match(MOMENT_LINK)
  return match ? { videoId: match[1], start: Number(match[2]) } : undefined
}

/** The first class moment an entry links to: the class the entry was taken from. */
export const firstClassMomentIn = (html: string): ClassMoment | undefined =>
  classMomentOf(html)
