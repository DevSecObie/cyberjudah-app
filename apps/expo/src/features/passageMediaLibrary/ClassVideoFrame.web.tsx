/** CyberJudah's hosted video page in a frame, as on the phone. */
const ClassVideoFrame = ({ uri }: { uri: string }) => (
  <iframe
    src={uri}
    title="Class video"
    allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
    allowFullScreen
    style={{ border: 0, width: '100%', height: '100%', display: 'block', background: '#000' }}
  />
)

export default ClassVideoFrame
