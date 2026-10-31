import { atom } from 'jotai'

/** A class video kept playing in a small player docked over the app while the reader moves on. */
export type DockedClass = { videoId: string; title: string; start?: number }

export const dockedClassAtom = atom<DockedClass | null>(null)

const YOUTUBE_ID = /(?:youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/

export const youtubeIdOf = (url: string): string | undefined => url.match(YOUTUBE_ID)?.[1]
