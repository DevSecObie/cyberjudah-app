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

export type ClassCommand = {
  func: 'playVideo' | 'pauseVideo' | 'seekTo' | 'pictureInPicture' | 'mute' | 'unMute'
  args?: unknown[]
}

/**
 * Run inside the hosted video page on the phone, beside CLASS_TIME_SCRIPT: it reports whether the
 * video plays and how long it is, and passes the floating window's play, pause and skip on to the video.
 */
export const CLASS_CONTROL_SCRIPT = `(() => {
  if (window.__cyberJudahClassControls) return
  window.__cyberJudahClassControls = true
  if (!window.ReactNativeWebView) return
  // The video page adds its YouTube frame itself, and may not have yet: find it when needed.
  const frame = () => document.querySelector('iframe')
  let lastState
  let lastDuration = -1
  window.addEventListener('message', event => {
    if (!/^https:\\/\\/www\\.youtube(-nocookie)?\\.com$/.test(event.origin)) return
    let data
    try { data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data } catch (e) { return }
    if (data && typeof data.cyberJudahPictureInPictureMode === 'boolean') {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ classPictureInPicture: data.cyberJudahPictureInPictureMode })
      )
      return
    }
    const info = data && data.info
    const duration = info && info.duration
    if (typeof duration === 'number' && duration > 0 && Math.floor(duration) !== lastDuration) {
      lastDuration = Math.floor(duration)
      window.ReactNativeWebView.postMessage(JSON.stringify({ classDuration: duration }))
    }
    const state = info && info.playerState
    if (typeof state !== 'number' || state === lastState) return
    lastState = state
    window.ReactNativeWebView.postMessage(JSON.stringify({ classState: state }))
  })
  window.__cyberJudahCommand = (func, args) => {
    const target = frame()
    // Picture in Picture is the iPhone's own: the video inside YouTube's frame goes into it.
    if (func === 'pictureInPicture') {
      if (target && target.contentWindow)
        target.contentWindow.postMessage(JSON.stringify({ cyberJudahPictureInPicture: true }), '*')
      return
    }
    if (target && target.contentWindow)
      target.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args: args || [] }), '*')
  }
})(); true`

/** The call that hands a command to the video page from the app (CLASS_CONTROL_SCRIPT). */
export const classCommandScript = ({ func, args = [] }: ClassCommand) =>
  `window.__cyberJudahCommand && window.__cyberJudahCommand(${JSON.stringify(func)}, ${JSON.stringify(args)}); true`

/** Reads the video's length in seconds, as the video page reports it (CLASS_CONTROL_SCRIPT). */
export const classDurationFromMessage = (data: unknown): number | undefined => {
  if (typeof data !== 'string' || !data.includes('classDuration')) return undefined
  try {
    const value = (JSON.parse(data) as { classDuration?: unknown }).classDuration
    return typeof value === 'number' && value > 0 ? value : undefined
  } catch {
    return undefined
  }
}

/**
 * YouTube's player states: -1 not started, 0 ended, 1 playing, 2 paused, 3 buffering, 5 ready
 * (cued). Until a video has played once, only a tap on YouTube's own button may be able to start it.
 */
export const classNotStarted = (state: number) => state === -1 || state === 5

/** A playing time as a clock, the way the iPhone's and YouTube's players show it: 4:05, 1:02:09. */
export const classClock = (seconds: number) => {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

/** "1:35:20" or "12:38" as seconds. */
export const secondsOfClock = (clock?: string): number => {
  if (!clock || !/^\d+(?::\d{1,2}){0,2}$/.test(clock.trim())) return 0
  return clock
    .trim()
    .split(':')
    .reduce((total, part) => total * 60 + Number(part), 0)
}

/**
 * Run inside YouTube's frame on the phone: hands its video to the iPhone's own Picture in Picture
 * when the floating window asks (CLASS_CONTROL_SCRIPT), the window YouTube's own button opens.
 */
export const CLASS_PICTURE_IN_PICTURE_SCRIPT = `(() => {
  if (window.__cyberJudahPictureInPicture) return
  window.__cyberJudahPictureInPicture = true
  if (!/(^|\\.)youtube(-nocookie)?\\.com$/.test(location.hostname)) return
  // Tell the page (and so the app) when the video goes into or out of Picture in Picture.
  document.addEventListener(
    'webkitpresentationmodechanged',
    event => {
      const mode = event.target && event.target.webkitPresentationMode
      window.parent.postMessage(
        JSON.stringify({ cyberJudahPictureInPictureMode: mode === 'picture-in-picture' }),
        '*'
      )
    },
    true
  )
  window.addEventListener('message', event => {
    let data
    try { data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data } catch (e) { return }
    if (!data || !data.cyberJudahPictureInPicture) return
    const video = document.querySelector('video')
    if (!video) return
    if (video.webkitSupportsPresentationMode && video.webkitSupportsPresentationMode('picture-in-picture'))
      video.webkitSetPresentationMode(
        video.webkitPresentationMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture'
      )
    else if (video.requestPictureInPicture) video.requestPictureInPicture().catch(() => {})
  })
})(); true`

/**
 * The scripts for the hosted video page: the page's own scripts in the page, the Picture in
 * Picture one in YouTube's frame. Each ends in `true`, so they are joined with semicolons.
 */
export const CLASS_FRAME_SCRIPT = `if (window.top === window) { ${CLASS_TIME_SCRIPT};
${CLASS_CONTROL_SCRIPT}; } else { ${CLASS_PICTURE_IN_PICTURE_SCRIPT}; }
true`

/** Whether the video went into (true) or out of (false) the iPhone's Picture in Picture. */
export const classPictureInPictureFromMessage = (data: unknown): boolean | undefined => {
  if (typeof data !== 'string' || !data.includes('classPictureInPicture')) return undefined
  try {
    const value = (JSON.parse(data) as { classPictureInPicture?: unknown }).classPictureInPicture
    return typeof value === 'boolean' ? value : undefined
  } catch {
    return undefined
  }
}
