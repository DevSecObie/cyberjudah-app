import { forwardRef, useImperativeHandle, useRef } from 'react'
import WebView from 'react-native-webview'
import {
  CLASS_CONTROL_SCRIPT,
  CLASS_TIME_SCRIPT,
  type ClassCommand,
  classCommandScript,
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

/** CyberJudah's hosted video page: YouTube refuses embeds from an inline page on the phone. */
const ClassVideoFrame = forwardRef<ClassVideoFrameHandle, Props>(
  ({ uri, onTime, onState, onDuration }, ref) => {
    const view = useRef<WebView>(null)
    useImperativeHandle(ref, () => ({
      command: command => view.current?.injectJavaScript(classCommandScript(command)),
    }))
    return (
      <WebView
        ref={view}
        source={{ uri }}
        style={{ flex: 1, backgroundColor: '#000' }}
        allowsInlineMediaPlayback
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction={false}
        injectedJavaScript={CLASS_TIME_SCRIPT + CLASS_CONTROL_SCRIPT}
        onMessage={event => {
          const seconds = classTimeFromMessage(event.nativeEvent.data)
          if (seconds !== undefined) onTime?.(seconds)
          const state = classStateFromMessage(event.nativeEvent.data)
          if (state !== undefined) onState?.(state)
          const duration = classDurationFromMessage(event.nativeEvent.data)
          if (duration !== undefined) onDuration?.(duration)
        }}
      />
    )
  }
)
ClassVideoFrame.displayName = 'ClassVideoFrame'

export default ClassVideoFrame
