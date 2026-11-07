import { Platform, Share } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { sharePdf } from '../sharePdf'

jest.mock('react-native', () => ({ Platform: { OS: 'ios' }, Share: { share: jest.fn() } }))
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  EncodingType: { Base64: 'base64' },
  writeAsStringAsync: jest.fn(),
}))
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn() }))

beforeEach(() => jest.clearAllMocks())

it('shares the generated iOS PDF through the anchored native activity sheet', async () => {
  Platform.OS = 'ios'
  await sharePdf('pdf-data', 'notes.pdf', 'Notes')
  expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
    'file:///cache/notes.pdf',
    'pdf-data',
    {
      encoding: 'base64',
    }
  )
  expect(Share.share).toHaveBeenCalledWith(
    { url: 'file:///cache/notes.pdf', title: 'Notes' },
    { subject: 'Notes' }
  )
  expect(Sharing.shareAsync).not.toHaveBeenCalled()
})

it('keeps the Android PDF MIME type and share flow', async () => {
  Platform.OS = 'android'
  await sharePdf('pdf-data', 'notes.pdf', 'Notes')
  expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///cache/notes.pdf', {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: 'Notes',
  })
  expect(Share.share).not.toHaveBeenCalled()
})
