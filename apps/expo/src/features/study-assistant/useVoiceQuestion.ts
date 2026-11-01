import { useEffect, useRef, useState } from 'react'
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio'
import { File } from 'expo-file-system'
import { listenToQuestion } from './cyberJudahAsk'

export type VoiceState = 'idle' | 'recording' | 'hearing'

// The server hears up to about a minute of speech.
const MAX_MS = 55000

/**
 * Ask by voice: tap the mic to speak, tap again to stop. The recording is written down by the
 * CyberJudah server and the text lands in the question box, to read over before sending. Nothing
 * is kept: the recording is deleted once heard.
 */
export function useVoiceQuestion({
  consent,
  onText,
  onError,
}: {
  consent: () => string[]
  onText: (text: string) => void
  onError: (error: unknown) => void
}) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const [state, setState] = useState<VoiceState>('idle')
  const limit = useRef<ReturnType<typeof setTimeout>>(undefined)
  const active = useRef<AbortController | null>(null)
  const handlers = useRef({ consent, onText, onError })
  handlers.current = { consent, onText, onError }

  useEffect(
    () => () => {
      clearTimeout(limit.current)
      active.current?.abort()
    },
    []
  )

  const release = () => setAudioModeAsync({ allowsRecording: false }).catch(() => undefined)

  const stop = async () => {
    clearTimeout(limit.current)
    if (!recorder.isRecording) return
    setState('hearing')
    const controller = new AbortController()
    active.current = controller
    let uri: string | null = null
    try {
      await recorder.stop()
      await release()
      uri = recorder.uri
      if (!uri) throw new Error('NO_RECORDING')
      const audio = await new File(uri).arrayBuffer()
      const text = await listenToQuestion(audio, handlers.current.consent(), controller.signal)
      if (!controller.signal.aborted) handlers.current.onText(text)
    } catch (error) {
      if (!controller.signal.aborted) handlers.current.onError(error)
    } finally {
      if (uri)
        try {
          new File(uri).delete()
        } catch {}
      if (active.current === controller) active.current = null
      setState('idle')
    }
  }

  const start = async () => {
    try {
      const permission = await requestRecordingPermissionsAsync()
      if (!permission.granted) throw new Error('MIC_DENIED')
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
      await recorder.prepareToRecordAsync()
      recorder.record()
      setState('recording')
      limit.current = setTimeout(() => void stop(), MAX_MS)
    } catch (error) {
      await release()
      setState('idle')
      handlers.current.onError(error)
    }
  }

  const cancel = () => {
    active.current?.abort()
    clearTimeout(limit.current)
    if (recorder.isRecording) void recorder.stop().catch(() => undefined)
    void release()
    setState('idle')
  }

  return { state, start, stop, cancel, supported: true as boolean }
}
