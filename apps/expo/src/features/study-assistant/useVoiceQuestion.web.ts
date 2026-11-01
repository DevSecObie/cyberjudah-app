import type { VoiceState } from './useVoiceQuestion'

/** On the website the browser's own dictation is used: the mic focuses the question box. */
export function useVoiceQuestion(_options: {
  consent: () => string[]
  onText: (text: string) => void
  onError: (error: unknown) => void
}) {
  const noop = async () => {}
  return {
    state: 'idle' as VoiceState,
    start: noop,
    stop: noop,
    cancel: () => {},
    supported: false as boolean,
  }
}
