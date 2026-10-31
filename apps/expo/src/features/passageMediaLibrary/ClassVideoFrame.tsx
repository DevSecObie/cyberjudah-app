import WebView from 'react-native-webview'

/** CyberJudah's hosted video page: YouTube refuses embeds from an inline page on the phone. */
const ClassVideoFrame = ({ uri }: { uri: string }) => (
  <WebView
    source={{ uri }}
    style={{ flex: 1, backgroundColor: '#000' }}
    allowsInlineMediaPlayback
    allowsFullscreenVideo
    mediaPlaybackRequiresUserAction={false}
  />
)

export default ClassVideoFrame
