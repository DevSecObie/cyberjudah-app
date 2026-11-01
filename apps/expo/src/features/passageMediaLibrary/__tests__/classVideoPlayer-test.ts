import {
  classClock,
  classDurationFromMessage,
  classNotStarted,
  classStateFromMessage,
} from '../classVideoPosition'

describe('the floating class player', () => {
  it('shows times as the iPhone and YouTube players do', () => {
    expect(classClock(0)).toBe('0:00')
    expect(classClock(65.9)).toBe('1:05')
    expect(classClock(3729)).toBe('1:02:09')
    expect(classClock(-4)).toBe('0:00')
    expect(classClock(Number.NaN)).toBe('0:00')
  })

  it('reads the length the video page reports, and nothing else', () => {
    expect(classDurationFromMessage(JSON.stringify({ classDuration: 5321.4 }))).toBe(5321.4)
    expect(classDurationFromMessage(JSON.stringify({ classDuration: 0 }))).toBeUndefined()
    expect(classDurationFromMessage(JSON.stringify({ classTime: 12 }))).toBeUndefined()
    expect(classDurationFromMessage('classDuration{')).toBeUndefined()
    expect(classDurationFromMessage(undefined)).toBeUndefined()
  })

  it('knows a video YouTube has not started yet', () => {
    expect(classNotStarted(-1)).toBe(true)
    expect(classNotStarted(5)).toBe(true)
    expect(classNotStarted(1)).toBe(false)
    expect(classNotStarted(2)).toBe(false)
    expect(classStateFromMessage(JSON.stringify({ classState: 5 }))).toBe(5)
  })
})
