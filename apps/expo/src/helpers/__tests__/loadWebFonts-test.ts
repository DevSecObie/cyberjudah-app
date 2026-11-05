import { loadAsync } from 'expo-font'
import { loadWebFonts } from '../loadWebFonts'

jest.mock('expo-font', () => ({ loadAsync: jest.fn(async () => undefined) }))
jest.mock('../appFonts', () => ({
  appFonts: { 'Literata Book': 1, FiraCode: 3, Feather: 4 },
}))

it('requests the bundled reading and title faces before completing web font preparation', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const load = jest.fn(async (_font: string) => [])
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { fonts: { load } } })
  try {
    await loadWebFonts()
    expect(loadAsync).toHaveBeenCalledWith({ 'Literata Book': 1, FiraCode: 3 })
    expect(loadAsync).toHaveBeenCalledWith({ Feather: 4 })
    expect(load.mock.calls.map(call => call[0])).toEqual([
      '16px "Literata Book"',
      '16px "FiraCode"',
    ])
  } finally {
    if (original) Object.defineProperty(globalThis, 'document', original)
    else Reflect.deleteProperty(globalThis, 'document')
  }
})
