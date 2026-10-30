import { goBackOrHome } from '../goBackOrHome'

const makeRouter = (canGoBack: boolean) => ({
  canGoBack: jest.fn(() => canGoBack),
  back: jest.fn(),
  replace: jest.fn(),
})

describe('goBackOrHome', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('goes back when there is a screen to go back to', () => {
    const router = makeRouter(true)
    goBackOrHome(router)
    expect(router.back).toHaveBeenCalledTimes(1)
    expect(router.replace).not.toHaveBeenCalled()
  })

  it('goes home from a direct link', () => {
    const router = makeRouter(false)
    goBackOrHome(router)
    expect(router.replace).toHaveBeenCalledWith('/')
    expect(router.back).not.toHaveBeenCalled()
  })

  it('ignores a second tap before the first back has landed', () => {
    const router = makeRouter(true)
    goBackOrHome(router)
    goBackOrHome(router)
    expect(router.back).toHaveBeenCalledTimes(1)
    jest.advanceTimersByTime(500)
    goBackOrHome(router)
    expect(router.back).toHaveBeenCalledTimes(2)
  })
})
