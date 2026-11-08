// Owner-approved omissions from the otherwise unchanged build 315 release.
export const OUTSIDE_AUDIO_ENABLED = false
export const TEXT_TO_SPEECH_ENABLED = false
export const SEARCH_TELEMETRY_ENABLED = false

export const isOwnedAudioUrl = (url: string) => {
  try {
    const parsed = new URL(url)
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname === 'cyberjudah.io' || parsed.hostname.endsWith('.cyberjudah.io'))
    )
  } catch {
    return false
  }
}
