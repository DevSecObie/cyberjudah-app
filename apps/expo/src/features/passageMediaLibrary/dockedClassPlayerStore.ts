import { atom } from 'jotai'

/** A class video kept playing in a small player docked over the app while the reader moves on. */
export type DockedClass = {
  videoId: string
  title: string
  start?: number
  /** The page the class was started from; tapping the title goes back there. */
  returnTo?: { pathname: string; params: Record<string, string | string[]> }
}

export const dockedClassAtom = atom<DockedClass | null>(null)

/**
 * Asks the docked player to hand the class back to its page. Counted, so each ask is new. The
 * player first brings the video out of the iPhone's Picture in Picture, where it may be playing.
 */
export const dockedClassReturnAtom = atom(0)

const YOUTUBE_ID = /(?:youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/

export const youtubeIdOf = (url: string): string | undefined => url.match(YOUTUBE_ID)?.[1]
