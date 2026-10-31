/**
 * Where each class video was last playing, so the class picks up at the same moment when it moves
 * between the class page and the floating player, or is closed and opened again.
 */
const positions = new Map<string, number>()

export const rememberClassPosition = (videoId: string, seconds: number) => {
  if (Number.isFinite(seconds) && seconds >= 0) positions.set(videoId, Math.floor(seconds))
}

export const classPositionOf = (videoId: string): number | undefined => positions.get(videoId)

/** The moment to start a class at: where it was left, or else the moment asked for. */
export const resumeClassAt = (videoId: string, fallback = 0) => positions.get(videoId) ?? fallback

/** Reads a time the video page posted back (see CLASS_TIME_SCRIPT). */
export const classTimeFromMessage = (data: unknown): number | undefined => {
  if (typeof data !== 'string' || !data.includes('classTime')) return undefined
  try {
    const value = (JSON.parse(data) as { classTime?: unknown }).classTime
    return typeof value === 'number' ? value : undefined
  } catch {
    return undefined
  }
}

/**
 * Run inside CyberJudah's hosted video page on the phone. It turns on YouTube's player messages
 * for the video inside the page, then posts the playing time back to the app each second.
 */
export const CLASS_TIME_SCRIPT = `(() => {
  if (window.__cyberJudahClassTime) return
  window.__cyberJudahClassTime = true
  const frame = document.querySelector('iframe')
  if (!frame || !window.ReactNativeWebView) return
  let heard = false
  let last = -1
  const hello = () => {
    if (!frame.contentWindow) return
    frame.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*')
  }
  window.addEventListener('message', event => {
    if (!/^https:\\/\\/www\\.youtube(-nocookie)?\\.com$/.test(event.origin)) return
    let data
    try { data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data } catch (e) { return }
    heard = true
    const time = data && data.info && data.info.currentTime
    if (typeof time !== 'number' || Math.floor(time) === last) return
    last = Math.floor(time)
    window.ReactNativeWebView.postMessage(JSON.stringify({ classTime: time }))
  })
  // A video started again elsewhere (a timestamp in the notes) needs to be greeted again.
  frame.addEventListener('load', () => { heard = false; hello() })
  setInterval(() => { if (!heard) hello() }, 1000)
  const url = new URL(frame.src)
  if (url.searchParams.get('enablejsapi') !== '1') {
    url.searchParams.set('enablejsapi', '1')
    frame.src = url.toString()
  } else hello()
})(); true`

/** Reads whether the video plays, as the video page reports it (YouTube's 1 playing, 2 paused). */
export const classStateFromMessage = (data: unknown): number | undefined => {
  if (typeof data !== 'string' || !data.includes('classState')) return undefined
  try {
    const value = (JSON.parse(data) as { classState?: unknown }).classState
    return typeof value === 'number' ? value : undefined
  } catch {
    return undefined
  }
}

export type ClassCommand = { func: 'playVideo' | 'pauseVideo' | 'seekTo'; args?: unknown[] }

/**
 * Run inside the hosted video page on the phone, beside CLASS_TIME_SCRIPT: it reports whether the
 * video plays, and passes the floating window's play, pause and skip on to the video.
 */
export const CLASS_CONTROL_SCRIPT = `(() => {
  if (window.__cyberJudahClassControls) return
  window.__cyberJudahClassControls = true
  const frame = document.querySelector('iframe')
  if (!frame || !window.ReactNativeWebView) return
  let lastState
  window.addEventListener('message', event => {
    if (!/^https:\\/\\/www\\.youtube(-nocookie)?\\.com$/.test(event.origin)) return
    let data
    try { data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data } catch (e) { return }
    const state = data && data.info && data.info.playerState
    if (typeof state !== 'number' || state === lastState) return
    lastState = state
    window.ReactNativeWebView.postMessage(JSON.stringify({ classState: state }))
  })
  window.__cyberJudahCommand = (func, args) => {
    if (frame.contentWindow)
      frame.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args: args || [] }), '*')
  }
})(); true`

/** The call that hands a command to the video page from the app (CLASS_CONTROL_SCRIPT). */
export const classCommandScript = ({ func, args = [] }: ClassCommand) =>
  `window.__cyberJudahCommand && window.__cyberJudahCommand(${JSON.stringify(func)}, ${JSON.stringify(args)}); true`
