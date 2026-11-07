import { decodeHTML } from 'entities'
import { Platform } from 'react-native'
import { sharePdf } from './sharePdf'

/** Native WebKit/Android printing retains Unicode, images and CSS colors in a paginated PDF. */
export async function printScreenPdf(html: string, fileName: string, title: string) {
  if (Platform.OS === 'web') {
    const frame = document.createElement('iframe')
    frame.style.position = 'fixed'
    frame.style.width = '0'
    frame.style.height = '0'
    frame.style.border = '0'
    frame.srcdoc = html
    frame.onload = () => {
      const target = frame.contentWindow
      if (!target) return
      target.addEventListener('afterprint', () => frame.remove(), { once: true })
      target.focus()
      target.print()
    }
    document.body.appendChild(frame)
    return
  }
  // WKWebView printing cannot load local image URLs; embed the same offline portraits.
  for (const match of [...html.matchAll(/src="(file:[^"]+)"/g)]) {
    const FileSystem = await import('expo-file-system/legacy')
    const uri = decodeHTML(match[1])
    const bytes = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    })
    const mime = /\.webp$/i.test(uri) ? 'webp' : /\.jpe?g$/i.test(uri) ? 'jpeg' : 'png'
    html = html.replace(match[0], `src="data:image/${mime};base64,${bytes}"`)
  }
  if (html.includes('font-family:Literata Book')) {
    const { Asset } = await import('expo-asset')
    const FileSystem = await import('expo-file-system/legacy')
    const font = Asset.fromModule(require('~assets/fonts/LiterataBook-Regular.otf'))
    await font.downloadAsync()
    if (!font.localUri) throw new Error('PDF font is unavailable')
    const bytes = await FileSystem.readAsStringAsync(font.localUri, {
      encoding: FileSystem.EncodingType.Base64,
    })
    html = html.replace(
      '</style>',
      `@font-face {font-family:'Literata Book';src:url(data:font/otf;base64,${bytes}) format('opentype');}</style>`
    )
  }
  const { printToFileAsync } = await import('expo-print')
  const result = await printToFileAsync({
    html,
    base64: true,
    width: 612,
    height: 792,
    margins: { top: 36, right: 36, bottom: 36, left: 36 },
  })
  if (!result.base64) throw new Error('PDF output was empty')
  await sharePdf(result.base64, fileName, title)
}
