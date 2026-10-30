import { useState } from 'react'
import WebView from 'react-native-webview'
import { useTheme } from '~themes/ThemeProvider'

// The page reports its height, and every link tap, back to the app; it never navigates itself.
const BRIDGE = `
  const post = message => window.ReactNativeWebView.postMessage(JSON.stringify(message))
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href], [data-href]')
    if (!link) return
    event.preventDefault()
    post({ href: link.getAttribute('href') || link.getAttribute('data-href') })
  })
  new ResizeObserver(() => post({ height: document.body.scrollHeight })).observe(document.body)
  true
`

const pageHtml = (
  notes: string,
  colors: {
    text: string
    muted: string
    link: string
    surface: string
    border: string
    block: string
    blockText: string
  }
) => `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<style>
  :root { color-scheme: light dark; }
  html, body { margin: 0; padding: 0; background: transparent; }
  body { font: 17px/1.6 -apple-system, system-ui, Roboto, sans-serif; color: ${colors.text};
    -webkit-text-size-adjust: none; overflow-wrap: break-word; padding-bottom: 40px; }
  a { color: ${colors.link}; text-decoration: none; }
  p { margin: 0 0 14px; }
  .taught { font-size: 13px; letter-spacing: .04em; text-transform: uppercase; color: ${colors.muted}; margin-bottom: 10px; }
  .opens { display: block; font-size: 14px; line-height: 1.9; color: ${colors.muted}; margin-bottom: 8px; }
  .opens b { color: ${colors.text}; margin-right: 4px; }
  h1, h2 { font-size: 21px; line-height: 1.3; margin: 32px 0 14px; padding-bottom: 8px; border-bottom: 1px solid ${colors.border}; }
  h3, h4 { font-size: 18px; margin: 24px 0 10px; }
  .passage { font-size: 17px; margin: 26px 0 10px; display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
  .passage b a { color: ${colors.text}; }
  a.ts { display: inline-block; font-size: 13px; font-weight: 600; line-height: 1; padding: 5px 9px 5px 8px;
    border-radius: 999px; background: ${colors.surface}; color: ${colors.link}; margin-right: 6px; vertical-align: 2px;
    font-variant-numeric: tabular-nums; }
  a.ts::before { content: '\\25B6'; font-size: 9px; margin-right: 5px; vertical-align: 1px; }
  /* Bible Strong's verse block (studies), in the reader's colours. */
  .block-verse { position: relative; box-sizing: border-box; margin: 0 0 16px; padding: 10px 12px 12px 12px;
    border-radius: 10px; background: ${colors.block}; color: ${colors.blockText};
    -webkit-tap-highlight-color: transparent; transition: opacity 120ms ease, transform 120ms ease; }
  .block-verse:active { opacity: .62; transform: scale(.995); }
  .block-verse--content { padding-right: 32px; quotes: '\u201C' '\u201D'; font-style: italic; }
  .block-verse--content p { margin: 0 0 6px; }
  .block-verse--content p:first-child::before { content: open-quote; }
  .block-verse--content p:last-child::after { content: close-quote; }
  .block-verse--content p:first-child::before, .block-verse--content p:last-child::after {
    font-size: 20px; font-weight: bold; line-height: 0; opacity: .2; }
  .block-verse--content sup { font-style: normal; font-size: 11px; font-weight: 700; opacity: .6; margin-right: 2px; }
  .block-verse--top { margin-bottom: 8px; display: flex; gap: 10px; font-size: 15px; font-weight: 600; }
  .block-verse--top b { font-size: 13px; opacity: .6; align-self: center; }
  .block-verse--top a.ts { margin: 0 0 0 auto; align-self: center; vertical-align: 0; }
  .block-verse--arrow { position: absolute; right: 15px; bottom: 12px; color: ${colors.blockText}; }
  blockquote { margin: 0 0 16px; padding-left: 12px; border-left: 3px solid ${colors.border}; }
  ul { margin: 0 0 16px; padding-left: 20px; }
  li { margin: 0 0 10px; }
  li > p { margin-bottom: 8px; }
  li li { list-style: none; }
  li ul { padding-left: 0; margin-top: 4px; }
  li li > blockquote { margin-left: 0; }
  .label { font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: ${colors.muted}; margin: 14px 0 6px; }
  .reading { margin: 0 0 18px; padding: 14px 16px 4px; border: 1px solid ${colors.border}; border-radius: 12px; }
  hr { border: 0; border-top: 1px solid ${colors.border}; margin: 28px 0; }
</style></head><body>${notes}</body></html>`

/** A class's notes, laid out like the website: verses, the precepts under them, timestamps. */
export default function ClassNotesView({
  html,
  onLinkPress,
  fill,
}: {
  html: string
  onLinkPress: (href: string) => void
  /** Fill the space given and scroll inside, rather than grow as tall as the notes. */
  fill?: boolean
}) {
  const theme = useTheme()
  const [height, setHeight] = useState(600)
  return (
    <WebView
      originWhitelist={['about:blank']}
      source={{
        html: pageHtml(html, {
          text: theme.colors.default,
          muted: theme.colors.grey,
          link: theme.colors.primary,
          surface: theme.colors.lightGrey,
          border: theme.colors.border,
          block: 'rgba(89, 131, 240, 0.08)',
          blockText: theme.colors.default,
        }),
      }}
      injectedJavaScript={BRIDGE}
      onMessage={event => {
        try {
          const message = JSON.parse(event.nativeEvent.data) as { href?: string; height?: number }
          if (typeof message.href === 'string') onLinkPress(message.href)
          else if (message.height && message.height > 0) setHeight(Math.ceil(message.height))
        } catch {}
      }}
      onShouldStartLoadWithRequest={request => request.url === 'about:blank'}
      scrollEnabled={!!fill}
      style={{
        width: '100%',
        backgroundColor: 'transparent',
        ...(fill ? { flex: 1 } : { height }),
      }}
      containerStyle={fill ? { flex: 1 } : { flex: 0 }}
    />
  )
}
