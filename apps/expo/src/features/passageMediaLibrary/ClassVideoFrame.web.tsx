import { useEffect, useRef } from 'react'
import { classTimeFromMessage } from './classVideoPosition'

/** CyberJudah's hosted video page in a frame, as on the phone. */
const ClassVideoFrame = ({ uri, onTime }: { uri: string; onTime?: (seconds: number) => void }) => {
  const frame = useRef<HTMLIFrameElement>(null)
  const onTimeRef = useRef(onTime)
  onTimeRef.current = onTime
  useEffect(() => {
    // The page posts the playing time up to the window that frames it.
    const listen = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return
      const seconds = classTimeFromMessage(event.data)
      if (seconds !== undefined) onTimeRef.current?.(seconds)
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

export default ClassVideoFrame
