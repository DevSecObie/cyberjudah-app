import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import {
  type ClassCommand,
  classDurationFromMessage,
  classStateFromMessage,
  classTimeFromMessage,
} from './classVideoPosition'

export type ClassVideoFrameHandle = { command: (command: ClassCommand) => void }

type Props = {
  uri: string
  onTime?: (seconds: number) => void
  /** YouTube's player state: 1 playing, 2 paused. */
  onState?: (state: number) => void
  /** The video's length in seconds, once YouTube reports it. */
  onDuration?: (seconds: number) => void
}

/** CyberJudah's hosted video page in a frame, as on the phone. */
const ClassVideoFrame = forwardRef<ClassVideoFrameHandle, Props>(
  ({ uri, onTime, onState, onDuration }, ref) => {
    const frame = useRef<HTMLIFrameElement>(null)
    const handlers = useRef({ onTime, onState, onDuration })
    handlers.current = { onTime, onState, onDuration }
    // The page passes play, pause and skip on to the video (public/embed/youtube.html).
    useImperativeHandle(ref, () => ({
      command: command =>
        frame.current?.contentWindow?.postMessage(JSON.stringify({ classCommand: command }), '*'),
    }))
    useEffect(() => {
      // The page posts the playing time and state up to the window that frames it.
      const listen = (event: MessageEvent) => {
        if (event.source !== frame.current?.contentWindow) return
        const seconds = classTimeFromMessage(event.data)
        if (seconds !== undefined) handlers.current.onTime?.(seconds)
        const state = classStateFromMessage(event.data)
        if (state !== undefined) handlers.current.onState?.(state)
        const duration = classDurationFromMessage(event.data)
        if (duration !== undefined) handlers.current.onDuration?.(duration)
      }
      window.addEventListener('message', listen)
      return () => window.removeEventListener('message', listen)
    }, [])
    return (
      <iframe
        ref={frame}
        src={uri}
        title="Class video"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        style={{ border: 0, width: '100%', height: '100%', display: 'block', background: '#000' }}
      />
    )
  }
)
ClassVideoFrame.displayName = 'ClassVideoFrame'

export default ClassVideoFrame
