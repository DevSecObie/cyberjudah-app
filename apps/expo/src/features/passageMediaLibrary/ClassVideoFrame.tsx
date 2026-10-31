import WebView from 'react-native-webview'
import { CLASS_TIME_SCRIPT, classTimeFromMessage } from './classVideoPosition'

/** CyberJudah's hosted video page: YouTube refuses embeds from an inline page on the phone. */
const ClassVideoFrame = ({ uri, onTime }: { uri: string; onTime?: (seconds: number) => void }) => (
  <WebView
    source={{ uri }}
    style={{ flex: 1, backgroundColor: '#000' }}
    allowsInlineMediaPlayback
    allowsFullscreenVideo
    mediaPlaybackRequiresUserAction={false}
    injectedJavaScript={CLASS_TIME_SCRIPT}
    onMessage={event => {
      const seconds = classTimeFromMessage(event.nativeEvent.data)
      if (seconds !== undefined) onTime?.(seconds)
    }}
  />
)

export default ClassVideoFrame
