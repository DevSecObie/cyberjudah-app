import { isTelegramHost, readTelegramLaunch, startParamToRoute } from '../telegramLaunch'

test('reads Telegram’s launch data from the address, fragment first', () => {
  expect(
    readTelegramLaunch(
      '#tgWebAppData=query_id%3DAA%26user%3D%257B%257D&tgWebAppVersion=8.0&other=1',
      '?tgWebAppStartParam=genesis_1'
    )
  ).toEqual({
    tgWebAppData: 'query_id=AA&user=%7B%7D',
    tgWebAppVersion: '8.0',
    tgWebAppStartParam: 'genesis_1',
  })
  expect(readTelegramLaunch('', '')).toEqual({})
})

test('a start parameter opens its chapter, at its first verse', () => {
  expect(startParamToRoute('genesis_1')).toBe('/bible/genesis/1')
  expect(startParamToRoute('bible_john_3_16-18x20')).toBe('/bible/john/3/16')
  expect(startParamToRoute('notes_genesis')).toBe(null)
  expect(startParamToRoute('../etc')).toBe(null)
  expect(startParamToRoute(undefined)).toBe(null)
})

test('launch data in a plain browser link does not count as Telegram', () => {
  const browser: { parent?: unknown } = {}
  browser.parent = browser
  expect(isTelegramHost(browser)).toBe(false)
  const phone: { parent?: unknown; TelegramWebviewProxy: object } = { TelegramWebviewProxy: {} }
  phone.parent = phone
  expect(isTelegramHost(phone)).toBe(true)
  const desktop: { parent?: unknown; external: object } = { external: { notify: () => {} } }
  desktop.parent = desktop
  expect(isTelegramHost(desktop)).toBe(true)
  expect(isTelegramHost({ parent: {} })).toBe(true) // Telegram Web's frame
})
