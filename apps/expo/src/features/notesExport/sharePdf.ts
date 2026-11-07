import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { Platform, Share } from 'react-native'

/**
 * Hands a PDF to the system share sheet (Save to Files, Print, Mail, Messages, AirDrop...).
 * The file is written to the cache, where the system clears it in time.
 */
export async function sharePdf(base64: string, fileName: string, dialogTitle: string) {
  if (Platform.OS === 'web') {
    const link = document.createElement('a')
    link.href = `data:application/pdf;base64,${base64}`
    link.download = fileName
    link.click()
    return
  }
  const uri = `${FileSystem.cacheDirectory}${fileName}`
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 })
  if (Platform.OS === 'ios') {
    // React Native anchors the activity popover to the presenting iPad view.
    // expo-sharing's size-class guard can leave it unanchored in compact windows.
    await Share.share({ url: uri, title: dialogTitle }, { subject: dialogTitle })
    return
  }
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle })
}
