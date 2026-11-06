import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import PassageMediaPlayerScreen from '../PassageMediaPlayerScreen'

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  useWindowDimensions: () => ({ width: 390 }),
}))
jest.mock('~helpers/storage', () => ({ storage: { getString: () => undefined, set: () => {} } }))
const mockLoad = jest.fn()
const mockRead = jest.fn()
jest.mock('../cyberJudahClasses', () => ({
  readCachedClassLibrary: () => mockRead(),
  loadClassLibrary: () => mockLoad(),
}))
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ workId: 'cyberjudah-class-QvZ1lHD3DYM' }),
  useGlobalSearchParams: () => ({}),
  usePathname: () => '/passage-media-player',
  useRouter: () => ({}),
}))
jest.mock('~features/bible/passageMedia', () => ({
  getPassageMediaById: () => null,
  getPassageMediaEmbedUrl: () => 'https://cyberjudah.io/video',
  formatPassageMediaDuration: () => '',
}))
jest.mock('~helpers/editorialProfile', () => ({ usesCyberJudahEditorial: () => true }))
jest.mock('~helpers/useLanguage', () => () => 'en')
jest.mock('~helpers/constants', () => ({ IS_FORM_SHEET: false }))
jest.mock('~features/history/useRecordHistory', () => ({ useRecordHistory: () => {} }))
jest.mock('~themes/ThemeProvider', () => ({
  useTheme: () => ({ fontFamily: { title: '', text: '' } }),
}))
jest.mock('~themes/styleValues', () => ({ resolveFontFamily: () => undefined }))
jest.mock('~common/ui/FormSheetScreen', () => 'FormSheet')
jest.mock('~common/Header', () => 'Header')
jest.mock('~common/Loading', () => 'Loading')
jest.mock('~common/ui/Box', () => ({
  __esModule: true,
  default: 'Box',
  TouchableBox: 'Touch',
  VStack: 'Stack',
}))
jest.mock('~common/ui/Text', () => 'Text')
jest.mock('~common/ui/Icon', () => ({ MaterialIcon: 'Icon', FeatherIcon: 'Icon' }))
jest.mock('~common/inAppBrowser', () => ({ openInApp: () => {} }))
jest.mock('~helpers/react-native-youtube-iframe', () => 'Youtube')
jest.mock('react-native-webview', () => 'WebView')
jest.mock('../PipGlass', () => 'Glass')
jest.mock('../ClassVideoFrame', () => 'Frame')
jest.mock('../ClassNotesList', () => 'Notes')
jest.mock('~features/notesExport/ClassNotesPdfButton', () => 'PdfButton')
jest.mock('~features/commentaries/commentaryReferenceNavigation', () => ({}))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

it('opens a direct class link on a fresh install before the library has been visited', async () => {
  const environment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  const previous = environment.IS_REACT_ACT_ENVIRONMENT
  environment.IS_REACT_ACT_ENVIRONMENT = true
  mockRead.mockReturnValue(null)
  let publish!: (rows: unknown[]) => void
  mockLoad.mockReturnValue(
    new Promise(resolve => {
      publish = resolve
    })
  )
  const client = new QueryClient()
  let screen!: ReactTestRenderer
  try {
    await act(async () => {
      screen = create(
        <QueryClientProvider client={client}>
          <PassageMediaPlayerScreen />
        </QueryClientProvider>
      )
    })
    expect(mockLoad).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(screen.toJSON())).not.toContain('passageMediaLibrary.notFound')
    await act(async () => {
      publish([
        {
          workId: 'cyberjudah-class-QvZ1lHD3DYM',
          providerId: 'QvZ1lHD3DYM',
          title: 'Hebrews 1:1',
          notesPath: '',
          durationSeconds: 0,
        },
      ])
      await new Promise(resolve => setTimeout(resolve, 20))
    })
    expect(JSON.stringify(screen.toJSON())).toContain('Hebrews 1:1')
  } finally {
    act(() => screen?.unmount())
    client.clear()
    environment.IS_REACT_ACT_ENVIRONMENT = previous
  }
})
