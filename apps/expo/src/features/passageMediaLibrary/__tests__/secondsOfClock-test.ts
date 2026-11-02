import { secondsOfClock } from '../classVideoPosition'

describe('secondsOfClock', () => {
  it('reads the classes clock as seconds', () => {
    expect(secondsOfClock('1:35:20')).toBe(5720)
    expect(secondsOfClock('12:38')).toBe(758)
    expect(secondsOfClock('45')).toBe(45)
  })

  it('starts at the beginning when there is no moment', () => {
    expect(secondsOfClock(undefined)).toBe(0)
    expect(secondsOfClock('soon')).toBe(0)
  })
})
