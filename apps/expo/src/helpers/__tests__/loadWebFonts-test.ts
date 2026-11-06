import { loadAsync } from 'expo-font'
import { loadWebFonts } from '../loadWebFonts'

jest.mock('expo-font', () => ({ loadAsync: jest.fn(async () => undefined) }))
jest.mock('../appFonts', () => ({
  appFonts: { 'Literata Book': 1, FiraCode: 3, feather: 4, 'material-community': 5 },
}))

it('requests the bundled reading and title faces before completing web font preparation', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const load = jest.fn(async (_font: string) => [])
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { fonts: { load } } })
  try {
    await loadWebFonts()
    expect(loadAsync).toHaveBeenCalledWith({ 'Literata Book': 1, FiraCode: 3 })
    expect(loadAsync).toHaveBeenCalledWith({ feather: 4 })
    // The large icon fonts wait for an idle moment after the first screen.
    expect(loadAsync).not.toHaveBeenCalledWith({ 'material-community': 5 })
    await new Promise(resolve => setTimeout(resolve, 4100))
    expect(loadAsync).toHaveBeenCalledWith({ 'material-community': 5 })
    expect(load.mock.calls.map(call => call[0])).toEqual([
      '16px "Literata Book"',
      '16px "FiraCode"',
    ])
  } finally {
    if (original) Object.defineProperty(globalThis, 'document', original)
    else Reflect.deleteProperty(globalThis, 'document')
  }
})
